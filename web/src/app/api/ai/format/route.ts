import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });


export async function POST(request: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { text, currentTime, answers, existingText, userContext, model } = await request.json();

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
        const result = await openai.chat.completions.create({
            model: model || "gpt-5.4-mini",
            messages: [{ role: "user", content: prompt }],
        });
        const formatted = (result.choices[0].message.content || "")
            .replace(/^[-・•]\s*/gm, "");
        return NextResponse.json({ formatted });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "予期しないエラーが発生しました";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
