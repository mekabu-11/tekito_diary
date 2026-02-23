import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

export async function POST(request: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { diaryText, originalMemo, dateKey, currentProfile } = await request.json();

    if (!diaryText || typeof diaryText !== "string" || diaryText.length > 20000) {
        return NextResponse.json({ error: "Invalid diaryText" }, { status: 400 });
    }

    const systemPrompt = [
        "あなたはユーザーのプロフィール抽出アシスタントです。日記からユーザー情報を抽出し、JSON形式で返してください。",
        "",
        "## A. コアプロファイル（永続的な情報）",
        "現在のプロファイル：",
        JSON.stringify(currentProfile || {}),
        "",
        "カテゴリ：",
        "- personality: 性格・趣味",
        "- people: 人間関係（名前付きで）",
        "- places: よく行く場所・お気に入りの店",
        "- work: 仕事・学校",
        "- lifestyle: 生活パターン・習慣",
        "- preferences: 好み（食べ物、音楽等）",
        "",
        "## B. エピソード（一時的な文脈情報）",
        "1〜2文で簡潔に。特になければ空配列。",
        "",
        '必ず以下のJSON形式のみで回答してください：{"profile":{"personality":[],"people":[],"places":[],"work":[],"lifestyle":[],"preferences":[]},"episodes":["要約"]}',
    ].join("\n");

    try {
        const result = await openai.chat.completions.create({
            model: "gpt-5-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `日記：\n${diaryText}\n\n元のメモ：\n${originalMemo}` },
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
            max_completion_tokens: 1000,
        });

        const parsed = JSON.parse(result.choices[0].message.content || "{}");
        const newProfile = parsed.profile;
        const newEpisodes = parsed.episodes;

        // コアプロファイル保存
        if (newProfile) {
            await supabase.from("core_profiles").upsert({
                user_id: user.id,
                ...newProfile,
                updated_at: new Date().toISOString(),
            });
        }

        // エピソード保存
        if (newEpisodes?.length > 0) {
            await supabase.from("episodes").insert(
                newEpisodes.map((content: string) => ({
                    user_id: user.id,
                    content,
                    date: dateKey,
                }))
            );

            // 50件超えたら古いのを削除
            const { data: allEpisodes } = await supabase
                .from("episodes")
                .select("id")
                .eq("user_id", user.id)
                .order("created_at", { ascending: true });

            if (allEpisodes && allEpisodes.length > 50) {
                const toDelete = allEpisodes.slice(0, allEpisodes.length - 50).map((e) => e.id);
                await supabase.from("episodes").delete().in("id", toDelete);
            }
        }

        return NextResponse.json({ success: true, profile: newProfile });
    } catch (error: unknown) {
        console.error("Profile learn error:", error);
        const errorMessage = error instanceof Error ? error.message : "学習エラー";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
