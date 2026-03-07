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

    let prompt = `以下の日記の文章をブラッシュアップしてください。

ルール：
- 書かれている事実や内容は絶対に変えない
- 新しい出来事や感情を勝手に追加しない
- 箇条書きにしない。自然な文章を維持する
- より読みやすく、自然な日本語にする
- 文章の構成や段落分けは必要に応じて改善してよい`;

    if (instruction?.trim()) {
        prompt += `\n\n【ユーザーからの指示】\n${instruction.trim()}`;
    }

    prompt += `\n\n【元の日記】\n${text}`;

    try {
        const result = await openai.chat.completions.create({
            model: model || "gpt-5-mini",
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
