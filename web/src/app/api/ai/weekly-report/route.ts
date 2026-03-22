/**
 * 週間振り返りレポート API（/api/ai/weekly-report）
 *
 * エンドポイント: POST /api/ai/weekly-report
 *
 * 先週（月〜日）の日記テキストを受け取り、
 * 3〜5行のまとめ（振り返りレポート）を生成する。
 * ダッシュボードの「週間振り返り」セクションに表示する。
 *
 * リクエストボディ:
 *   { texts: { date: string, text: string }[] }  — 先週分の日記（日付付き）
 *
 * レスポンス:
 *   { report: string }  — AI が生成した週間レポート
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
        return NextResponse.json({ report: "" });
    }

    const prompt = `以下は、ある人の先週1週間分の日記です。
この1週間を振り返り、3〜5行の簡潔なまとめを作成してください。

ルール:
- 親しみやすく温かいトーンで書く
- 事実ベースで書く（書かれていないことを推測しない）
- 「〜した週でした」のようにまとめる
- 前置きや「以下にまとめます」等の説明は不要、まとめ本文のみ出力
- 箇条書きではなく自然な文章で

日記一覧:
${texts.map((t: { date: string; text: string }) => `【${t.date}】\n${t.text}`).join("\n\n")}`;

    try {
        const result = await openai.chat.completions.create({
            model: "gpt-5.4-mini",
            messages: [{ role: "user", content: prompt }],
        });

        const report = result.choices[0].message.content?.trim() || "";
        return NextResponse.json({ report });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "予期しないエラーが発生しました";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
