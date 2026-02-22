import { createServerSupabase } from "@/lib/supabase-server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });


export async function POST(request: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { text, currentTime, answers, existingText, userContext } = await request.json();

    const timeContext = `現在の時刻は ${currentTime} です。メモに時間帯の手がかりがない場合、この時刻を参考に時間帯を自然に推測して反映してください。ただし無理に付け足さなくてよいです。`;

    let answersSection = "";
    if (answers?.length > 0) {
        answersSection = "\n\n【追加の詳細】\n" +
            answers.filter((a: { question: string; answer: string }) => a.answer.trim()).map((a: { question: string; answer: string }) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n");
    }

    let prompt: string;
    if (existingText) {
        prompt = `以下は同じ日に複数回書かれたメモです。一つの日記として整形してください。

${timeContext}
${userContext || ""}

ルール：
- 書かれている事実だけを淡々とまとめる
- 思ってもないことや感情を勝手に追加しない
- 誇張しない
- シンプルで読みやすい文章にする

【既存のメモ】
${existingText}

【追加のメモ】
${text}${answersSection}`;
    } else {
        prompt = `以下のメモを日記として整形してください。

${timeContext}
${userContext || ""}

ルール：
- 書かれている事実だけを淡々とまとめる
- 思ってもないことや感情を勝手に追加しない
- 誇張しない
- シンプルで読みやすい文章にする

メモ：
${text}${answersSection}`;
    }

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return NextResponse.json({ formatted: response.text() });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "予期しないエラーが発生しました";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
