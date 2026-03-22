/**
 * 今日の一言コメント API（/api/ai/comment）
 *
 * エンドポイント: POST /api/ai/comment
 *
 * 直近の日記テキスト（最大3件）を受け取り、
 * ユーザーへの温かい一言メッセージを生成する。
 * ダッシュボードの「AIからの一言」セクションに表示する。
 *
 * リクエストボディ:
 *   { texts: string[] }  — 直近の日記テキスト配列
 *
 * レスポンス:
 *   { comment: string }  — AI が生成した一言コメント
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
        return NextResponse.json({ comment: "日記を書いて、AIからのコメントをもらいましょう！" });
    }

    const prompt = `あなたはユーザーの日記を読んでいる、親身で頼りになる専属コーチ兼友人です。
以下のユーザーの最近の日記を読んで、温かいコメントと明日以降に向けたポジティブな行動提案を返してください。

【厳守ルール】
- 絵文字・顔文字・記号装飾は絶対に使わないこと（例: は禁止）
- 3〜4文程度（150文字前後）で構成する
- まずは直近の出来事や感情に対して深く共感する
- その上で、「具体的に次にどう行動するとよいか」や「今後に向けたポジティブな提案・視点」を入れる
- 説教くさくならないよう、あくまで提案ベースで温かい口調にする
- 前置きや引用は不要、コメント本文のみ出力

最近の日記:
${texts.join("\n\n---\n\n")}`;

    try {
        const result = await openai.chat.completions.create({
            model: "gpt-5.4-mini",
            messages: [{ role: "user", content: prompt }],
        });

        const comment = result.choices[0].message.content?.trim() || "今日も素敵な一日を";
        return NextResponse.json({ comment });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "予期しないエラーが発生しました";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
