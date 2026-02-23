import { ALLOWED_MODELS, DEFAULT_MODEL } from "@/lib/models";
import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

export async function POST(request: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { text, currentTime, answers, existingText, userContext, model } = await request.json();

    if (!text || typeof text !== "string" || text.length > 10000) {
        return NextResponse.json({ error: "Invalid text" }, { status: 400 });
    }
    if (model && !ALLOWED_MODELS.includes(model)) {
        return NextResponse.json({ error: "Invalid model" }, { status: 400 });
    }

    const systemPrompt = [
        "あなたは日記の整形アシスタントです。",
        "",
        "ルール：",
        "- 箇条書きは禁止。自然な文章でつなげて書くこと",
        "- 時系列に沿って、出来事を段落ごとにまとめる",
        "- 書かれている事実だけを淡々とまとめる",
        "- 思ってもないことや感情を勝手に追加しない",
        "- 誇張しない",
        "- シンプルで読みやすい文章にする",
        "- ユーザーコンテキストに書かれた過去の出来事は日記に含めないこと",
        "",
        `現在の時刻は ${currentTime} です。メモに時間帯の手がかりがない場合、この時刻を参考に時間帯を自然に推測して反映してください。ただし無理に付け足さなくてよいです。`,
        userContext || "",
    ].filter(Boolean).join("\n");

    let answersSection = "";
    if (answers?.length > 0) {
        answersSection = "\n\n【追加の詳細】\n" +
            answers
                .filter((a: { question: string; answer: string }) => a.answer.trim())
                .map((a: { question: string; answer: string }) => `Q: ${a.question}\nA: ${a.answer}`)
                .join("\n\n");
    }

    const userMessage = existingText
        ? `以下は同じ日に複数回書かれたメモです。一つの日記として整形してください。\n\n【既存のメモ】\n${existingText}\n\n【追加のメモ】\n${text}${answersSection}`
        : `以下のメモを日記として整形してください。\n\nメモ：\n${text}${answersSection}`;

    try {
        const result = await openai.chat.completions.create({
            model: model || DEFAULT_MODEL,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
            ...((model || DEFAULT_MODEL).includes("gpt-5.1-chat") ? {} : { temperature: 0.5 }),
            max_completion_tokens: 1200,
        });
        const formatted = (result.choices[0].message.content || "")
            .replace(/^[-・•]\s*/gm, "");
        return NextResponse.json({ formatted });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "予期しないエラーが発生しました";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
