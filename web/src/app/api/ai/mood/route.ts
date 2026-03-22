/**
 * 気分分析 API（/api/ai/mood）
 *
 * エンドポイント: POST /api/ai/mood
 *
 * 日記テキスト配列を受け取り、各日記の気分スコア（1〜5）を返す。
 * ダッシュボードの気分トレンドグラフに使用する。
 *
 * リクエストボディ:
 *   { texts: { date: string, text: string }[] }
 *
 * レスポンス:
 *   { scores: { date: string, score: number }[] }
 *
 * スコア: 1=とても悲しい, 2=やや落ち込み, 3=普通, 4=良い, 5=とても良い
 */
import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

export async function POST(request: NextRequest) {
    // 認証チェック
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { texts } = await request.json();

    if (!texts?.length) {
        return NextResponse.json({ scores: [] });
    }

    // AI に日記テキストを渡して気分スコアを判定させる
    const prompt = `以下の日記テキストそれぞれについて、書いた人の気分を1〜5のスコアで評価してください。

スコアの基準:
1 = とても辛い・悲しい
2 = やや落ち込んでいる・疲れている
3 = 普通・淡々としている
4 = 楽しい・充実している
5 = とても嬉しい・最高の気分

以下のJSON形式のみで回答してください。説明は不要です:
[{"date":"YYYY-MM-DD","score":N}, ...]

日記一覧:
${texts.map((t: { date: string; text: string }) => `[${t.date}]\n${t.text}`).join("\n\n---\n\n")}`;

    try {
        const result = await openai.chat.completions.create({
            model: "gpt-5.4-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
        });

        const content = result.choices[0].message.content || "{}";
        let parsed;
        try {
            parsed = JSON.parse(content);
        } catch {
            return NextResponse.json({ scores: [] });
        }

        // レスポンスが配列の場合とオブジェクトの場合の両方に対応
        const scores = Array.isArray(parsed) ? parsed : parsed.scores || parsed.results || [];
        return NextResponse.json({ scores });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "予期しないエラーが発生しました";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
