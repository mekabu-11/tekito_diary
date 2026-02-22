import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

export async function POST(request: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { text, userContext, model } = await request.json();

    const prompt = `以下のメモを読んで、日記をより具体的にするための深掘り質問を生成してください。

重要なルール：
- メモが抽象的・短い場合（例：「カレー食べた」）→ 質問を4〜5個生成して深掘りする
- メモがそこそこ具体的な場合 → 質問を2〜3個にする
- メモがすでに十分詳しい場合 → 質問は0〜1個でよい（空配列[]でもOK）
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
        const result = await openai.chat.completions.create({
            model: model || "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
        });
        const raw = (result.choices[0].message.content || "").trim();
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        const questions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        return NextResponse.json({ questions: questions.slice(0, 5) });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "予期しないエラーが発生しました";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
