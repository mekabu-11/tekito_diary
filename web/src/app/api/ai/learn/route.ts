/**
 * ユーザー情報学習 API
 *
 * エンドポイント: POST /api/ai/learn
 *
 * 日記の内容から AI がユーザーの情報を抽出し、2種類のデータとして保存する:
 *
 * 1. **コアプロファイル（core_profiles テーブル）**
 *    - 永続的な情報: 性格、人間関係、よく行く場所、仕事、生活習慣、好み
 *    - upsert で常に最新の状態に更新される
 *
 * 2. **エピソード（episodes テーブル）**
 *    - 一時的な出来事の要約（1〜2文）
 *    - 最大50件まで保持し、超過分は古いものから削除
 *
 * これらの情報は次回以降の日記生成時に「ユーザーコンテキスト」として活用され、
 * 固有名詞や人間関係を正しく理解した日記が生成される。
 *
 * リクエストボディ:
 * - diaryText: AI が整形した日記テキスト
 * - originalMemo: ユーザーが入力した元のメモ
 * - dateKey: 日付キー（例: "2026-03-20"）
 * - currentProfile: 現在のコアプロファイル（差分更新の参考）
 * - model: 使用する AI モデル名（任意、デフォルト: gpt-5.4-mini）
 */
import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

/** OpenAI クライアントの初期化 */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

export async function POST(request: NextRequest) {
    // 認証チェック
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { diaryText, originalMemo, dateKey, currentProfile, model } = await request.json();

    // AI にユーザー情報を抽出させるプロンプト
    // 現在のプロファイルを渡し、既存情報を踏まえた上で新しい情報を抽出させる
    const prompt = `以下の日記を読んで、この人についての情報を2つのカテゴリに分けて抽出してください。

## A. コアプロファイル（永続的な情報）
現在のプロファイル：
${JSON.stringify(currentProfile || {})}

カテゴリ：
- personality: 性格・趣味
- people: 人間関係（名前付きで）
- places: よく行く場所・お気に入りの店
- work: 仕事・学校
- lifestyle: 生活パターン・習慣
- preferences: 好み（食べ物、音楽等）

## B. エピソード（一時的な文脈情報）
1〜2文で簡潔に。特になければ空配列。

必ず以下のJSON形式のみで回答してください：
{"profile":{"personality":[],"people":[],"places":[],"work":[],"lifestyle":[],"preferences":[]},"episodes":["要約"]}

日記：
${diaryText}

元のメモ：
${originalMemo}`;

    try {
        // OpenAI API でユーザー情報を抽出
        const result = await openai.chat.completions.create({
            model: model || "gpt-5.4-mini",
            messages: [{ role: "user", content: prompt }],
        });
        const raw = (result.choices[0].message.content || "").trim();

        // --- JSON パース処理（AI の出力フォーマットのブレに対応） ---

        // 1. バッククォートによるコードブロック (```json ... ```) を除去
        let cleanRaw = raw.replace(/^```json/im, '').replace(/```$/m, '').trim();

        // 2. 波括弧 {} の外側にある余計な文字（説明テキスト等）を取り除く
        const match = cleanRaw.match(/\{[\s\S]*\}/);
        if (!match) {
            // JSON が見つからない場合は空データを返す
            return NextResponse.json({ profile: null, episodes: [] });
        }
        cleanRaw = match[0];

        const parsed = JSON.parse(cleanRaw);
        const newProfile = parsed.profile;   // 抽出されたプロファイル情報
        const newEpisodes = parsed.episodes; // 抽出されたエピソード情報

        // コアプロファイルを Supabase に保存（upsert: 存在すれば更新、なければ挿入）
        if (newProfile) {
            await supabase.from("core_profiles").upsert({
                user_id: user.id,
                ...newProfile,
                updated_at: new Date().toISOString(),
            });
        }

        // エピソードを Supabase に保存
        if (newEpisodes?.length > 0) {
            await supabase.from("episodes").insert(
                newEpisodes.map((content: string) => ({
                    user_id: user.id,
                    content,
                    date: dateKey,
                }))
            );

            // エピソードが50件を超えたら、古いものから削除してストレージを節約
            const { data: allEpisodes } = await supabase
                .from("episodes")
                .select("id")
                .eq("user_id", user.id)
                .order("created_at", { ascending: true });

            if (allEpisodes && allEpisodes.length > 50) {
                const toDelete = allEpisodes.slice(0, allEpisodes.length - 50).map((e) => e.id);
                await supabase.from("episodes").delete().in("id", toDelete);
            }
        }

        return NextResponse.json({ success: true, profile: newProfile });
    } catch (error: unknown) {
        console.error("Profile learn error:", error);
        const errorMessage = error instanceof Error ? error.message : "学習エラー";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
