/**
 * 深掘り質問生成 API
 *
 * エンドポイント: POST /api/ai/questions
 *
 * ユーザーが入力したメモの内容に基づいて、日記をより具体的にするための
 * 深掘り質問を AI が自動生成する。
 * 各質問には選択肢が付き、ユーザーは選択肢を選ぶか自由入力で回答できる。
 *
 * 質問数はメモの具体性に応じて動的に変化:
 * - 抽象的・短いメモ → 7〜10個
 * - そこそこ具体的 → 4〜6個
 * - 十分詳しい → 0〜2個（空配列も可）
 *
 * リクエストボディ:
 * - text: ユーザーが入力したメモ（必須）
 * - userContext: ユーザーのプロフィール情報（選択肢のパーソナライズ用、任意）
 * - model: 使用する AI モデル名（任意、デフォルト: gpt-5.4-mini）
 *
 * レスポンス: { questions: [{ question: "質問文", choices: ["選択肢1", "選択肢2", ...] }] }
 */
import { extractJsonArray } from "@/lib/parse-ai-json";
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

    const { text, userContext, model } = await request.json();

    // 入力長制限
    if (typeof text === "string" && text.length > 5000) {
        return NextResponse.json({ error: "メモが長すぎます（5000字以内）" }, { status: 400 });
    }
    if (typeof userContext === "string" && userContext.length > 2000) {
        return NextResponse.json({ error: "コンテキストが長すぎます" }, { status: 400 });
    }

    // AI に深掘り質問を生成させるプロンプト
    const prompt = `以下のメモを読んで、日記をより具体的にするための深掘り質問を生成してください。

重要なルール：
- メモが抽象的・短い場合（例：「カレー食べた」）→ 質問を7〜10個生成して深掘りする
- メモがそこそこ具体的な場合 → 質問を4〜6個にする
- メモがすでに十分詳しい場合 → 質問は0〜2個でよい（空配列[]でもOK）
- メモの内容から自然に膨らませられるポイント（場所、感想、誰と、どうだった等）を質問にする
${userContext || ""}

各質問には選択肢を3〜4つ付けてください。選択肢は短く自然なものにしてください。
ユーザーについて知っていることがあれば、選択肢に反映させてください。

必ず以下のJSON配列形式のみで回答してください：
[{"question": "質問文", "choices": ["選択肢1", "選択肢2", "選択肢3"]}]

質問が不要な場合は空配列を返してください：[]

メモ：
${text}`;

    try {
        // OpenAI API で質問を生成
        const result = await openai.chat.completions.create({
            model: model || "gpt-5.4-mini",
            messages: [{ role: "user", content: prompt }],
        });

        // AI の出力から JSON 配列部分を抽出（余計なテキストが含まれる場合に対応）
        const raw = (result.choices[0].message.content || "").trim();
        const questions = extractJsonArray(raw) || [];

        // 最大10問までに制限して返す
        return NextResponse.json({ questions: questions.slice(0, 10) });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "予期しないエラーが発生しました";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
