/**
 * メモ → 日記整形 API
 *
 * エンドポイント: POST /api/ai/format
 *
 * ユーザーが入力した雑なメモを、AI を使って自然な日記文章に整形する。
 * 深掘り質問への回答や既存メモとのマージにも対応する。
 *
 * リクエストボディ:
 * - text: 新しいメモのテキスト（必須）
 * - currentTime: 現在の時刻文字列（例: "14時30分"）（推測の参考用）
 * - answers: 深掘り質問への回答の配列（任意）
 * - existingText: マージ時の既存メモテキスト（任意）
 * - userContext: ユーザーのプロフィールや最近のエピソード情報（任意）
 * - model: 使用する AI モデル名（任意、デフォルト: gpt-5.4-mini）
 *
 * レスポンス: { formatted: "整形された日記テキスト" }
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

    const { text, currentTime, answers, existingText, userContext, model } = await request.json();

    // 入力長制限
    if (typeof text === "string" && text.length > 5000) {
        return NextResponse.json({ error: "メモが長すぎます（5000字以内）" }, { status: 400 });
    }
    if (typeof existingText === "string" && existingText.length > 5000) {
        return NextResponse.json({ error: "既存テキストが長すぎます" }, { status: 400 });
    }
    if (typeof userContext === "string" && userContext.length > 2000) {
        return NextResponse.json({ error: "コンテキストが長すぎます" }, { status: 400 });
    }

    // 時間帯の推測に使うコンテキスト（メモに時間の手がかりがない場合の参考）
    const timeContext = `現在の時刻は ${currentTime} です。メモに時間帯の手がかりがない場合、この時刻を参考に時間帯を自然に推測して反映してください。ただし無理に付け足さなくてよいです。`;

    // 深掘り質問への回答がある場合、プロンプトに追加するセクションを構築
    let answersSection = "";
    if (answers?.length > 0) {
        answersSection = "\n\n【追加の詳細】\n" +
            answers.filter((a: { question: string; answer: string }) => a.answer.trim()).map((a: { question: string; answer: string }) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n");
    }

    let prompt: string;
    if (existingText) {
        // マージモード: 同じ日に既存のメモがある場合、統合して日記にする
        prompt = `以下は同じ日に複数回書かれたメモです。一つの日記として整形してください。

${timeContext}
${userContext || ""}

ルール：
- 箇条書きは禁止。自然な文章でつなげて書くこと
- 時系列に沿って、出来事を段落ごとにまとめる
- 書かれている事実だけを淡々とまとめる
- 思ってもないことや感情を勝手に追加しない
- 誇張しない
- シンプルで読みやすい文章にする
- ユーザーコンテキストに書かれた過去の出来事は日記に含めないこと

【既存のメモ】
${existingText}

【追加のメモ】
${text}${answersSection}`;
    } else {
        // 新規モード: 単一のメモを日記に整形する
        prompt = `以下のメモを日記として整形してください。

${timeContext}
${userContext || ""}

ルール：
- 箇条書きは禁止。自然な文章でつなげて書くこと
- 時系列に沿って、出来事を段落ごとにまとめる
- 書かれている事実だけを淡々とまとめる
- 思ってもないことや感情を勝手に追加しない
- 誇張しない
- シンプルで読みやすい文章にする
- ユーザーコンテキストに書かれた過去の出来事は日記に含めないこと

メモ：
${text}${answersSection}`;
    }

    try {
        // OpenAI API で整形を実行
        const result = await openai.chat.completions.create({
            model: model || "gpt-5.1",
            messages: [{ role: "user", content: prompt }],
        });

        // 箇条書き記号を除去（AI がルールに反して箇条書きにすることがあるため）
        const formatted = (result.choices[0].message.content || "")
            .replace(/^[-・•]\s*/gm, "");
        return NextResponse.json({ formatted });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "予期しないエラーが発生しました";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
