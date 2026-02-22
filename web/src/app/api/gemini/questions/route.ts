import { createServerSupabase } from "@/lib/supabase-server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function POST(request: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { text, userContext } = await request.json();

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
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const raw = response.text().trim();
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        const questions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        return NextResponse.json({ questions: questions.slice(0, 5) });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
