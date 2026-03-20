/**
 * 日記ブラッシュアップ API
 *
 * エンドポイント: POST /api/ai/brushup
 *
 * AI を使って既存の日記の文章をブラッシュアップ（リライト）する。
 * ユーザーが指示を指定した場合はその指示に従い、
 * 指示なしの場合は一般的な読みやすさの改善を行う。
 *
 * リクエストボディ:
 * - text: ブラッシュアップ対象の日記テキスト（必須）
 * - instruction: ユーザーからの追加指示（例: "もっとカジュアルに"）（任意）
 * - model: 使用する AI モデル名（任意、デフォルト: gpt-5.4-mini）
 *
 * レスポンス: { brushedUp: "ブラッシュアップ後のテキスト" }
 */
import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

/** OpenAI クライアントの初期化 */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

export async function POST(request: NextRequest) {
    // 認証チェック: ログインしていないユーザーは弾く
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { text, instruction, model } = await request.json();

    // テキストが空の場合はバリデーションエラー
    if (!text) {
        return NextResponse.json({ error: "テキストが必要です" }, { status: 400 });
    }

    let prompt: string;

    if (instruction?.trim()) {
        // ユーザーが具体的な指示を入力した場合:
        // 指示内容を最優先で反映するプロンプトを使用
        prompt = `以下の日記の文章を、ユーザーの指示に従ってブラッシュアップしてください。
指示の内容を最優先で反映してください。

【最優先の指示】
${instruction.trim()}

注意点：
- 書かれている事実や出来事は変えない
- 指示にない内容を勝手に追加しない
- 修正後の日記本文のみを出力すること

【元の日記】
${text}`;
    } else {
        // 指示なしの場合:
        // 一般的な読みやすさの改善を行うプロンプトを使用
        prompt = `以下の日記の文章をブラッシュアップしてください。

ルール：
- 書かれている事実や内容は変えない
- 新しい出来事や感情を勝手に追加しない
- 箇条書きにしない。自然な文章を維持する
- より読みやすく、自然な日本語にする
- 文章の構成や段落分けは必要に応じて改善してよい
- 修正後の日記本文のみを出力すること
- 「以下のようにしました」等の説明や前置き、コメントは一切書かないこと

【元の日記】
${text}`;
    }

    try {
        // OpenAI API を呼び出してブラッシュアップを実行
        const result = await openai.chat.completions.create({
            model: model || "gpt-5.4-mini",
            messages: [{ role: "user", content: prompt }],
        });

        // AI の出力から箇条書き記号を除去（ルールに反して箇条書きになることがあるため）
        const brushedUp = (result.choices[0].message.content || "")
            .replace(/^[-・•]\s*/gm, "");
        return NextResponse.json({ brushedUp });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "予期しないエラーが発生しました";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
