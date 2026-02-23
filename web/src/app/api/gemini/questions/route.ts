import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

export async function POST(request: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { text, userContext } = await request.json();

    if (!text || typeof text !== "string" || text.length > 10000) {
        return NextResponse.json({ error: "Invalid text" }, { status: 400 });
    }

    const systemPrompt = [
        "あなたは日記の深掘りアシスタントです。ユーザーのメモから、日記をより具体的にするための質問をJSON形式で生成してください。",
        "",
        "重要なルール：",
        "- メモが抽象的・短い場合（例：「カレー食べた」）→ questionsを4〜5個生成して深掘りする",
        "- メモがそこそこ具体的な場合 → questionsを2〜3個にする",
        "- メモがすでに十分詳しい場合 → questionsは0〜1個でよい（空配列でもOK）",
        "- メモの内容から自然に膨らませられるポイント（場所、感想、誰と、どうだった等）を質問にする",
        "- 各質問には選択肢を3〜4つ付けること。選択肢は短く自然なものにすること",
        "- ユーザーについて知っていることがあれば、選択肢に反映させること",
        userContext || "",
        "",
        '必ず以下のJSON形式のみで回答してください：{"questions":[{"question":"質問文","choices":["選択肢1","選択肢2","選択肢3"]}]}',
        '質問が不要な場合：{"questions":[]}',
    ].filter(Boolean).join("\n");

    try {
        const result = await openai.chat.completions.create({
            model: "gpt-5-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `メモ：\n${text}` },
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
            max_completion_tokens: 800,
        });
        const parsed = JSON.parse(result.choices[0].message.content || "{}");
        const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
        return NextResponse.json({ questions: questions.slice(0, 5) });
    } catch (error: unknown) {
        console.error("[questions] Failed to generate questions:", error);
        const errorMessage = error instanceof Error ? error.message : "予期しないエラーが発生しました";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
