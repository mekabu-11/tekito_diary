import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

export async function POST(request: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { text, instruction, model } = await request.json();

    if (!text) {
        return NextResponse.json({ error: "テキストが必要です" }, { status: 400 });
    }

    let prompt: string;

    if (instruction?.trim()) {
        prompt = `以下の日記の文章を、ユーザーの指示に従ってブラッシュアップしてください。
指示の内容を最優先で反映してください。

【最優先の指示】
${instruction.trim()}

注意点：
- 書かれている事実や出来事は変えない
- 指示にない内容を勝手に追加しない

【元の日記】
${text}`;
    } else {
        prompt = `以下の日記の文章をブラッシュアップしてください。

ルール：
- 書かれている事実や内容は変えない
- 新しい出来事や感情を勝手に追加しない
- 箇条書きにしない。自然な文章を維持する
- より読みやすく、自然な日本語にする
- 文章の構成や段落分けは必要に応じて改善してよい

【元の日記】
${text}`;
    }

    try {
        const result = await openai.chat.completions.create({
            model: model || "gpt-5.4-mini",
            messages: [{ role: "user", content: prompt }],
        });
        const brushedUp = (result.choices[0].message.content || "")
            .replace(/^[-・•]\s*/gm, "");
        return NextResponse.json({ brushedUp });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "予期しないエラーが発生しました";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
