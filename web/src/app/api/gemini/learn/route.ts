import { createServerSupabase } from "@/lib/supabase-server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function POST(request: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { diaryText, originalMemo, dateKey, currentProfile } = await request.json();

    const prompt = `以下の日記を読んで、この人についての情報を2つのカテゴリに分けて抽出してください。

## A. コアプロファイル（永続的な情報）
現在のプロファイル：
${JSON.stringify(currentProfile || {})}

カテゴリ：
- personality: 性格・趣味
- people: 人間関係（名前付きで）
- places: よく行く場所・お気に入りの店
- work: 仕事・学校
- lifestyle: 生活パターン・習慣
- preferences: 好み（食べ物、音楽等）

## B. エピソード（一時的な文脈情報）
1〜2文で簡潔に。特になければ空配列。

必ず以下のJSON形式のみで回答してください：
{"profile":{"personality":[],"people":[],"places":[],"work":[],"lifestyle":[],"preferences":[]},"episodes":["要約"]}

日記：
${diaryText}

元のメモ：
${originalMemo}`;

    try {
        const result = await model.generateContent(prompt);
        const raw = result.response.text().trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return NextResponse.json({ profile: null, episodes: [] });

        const parsed = JSON.parse(jsonMatch[0]);

        // コアプロファイル保存
        if (parsed.profile) {
            await supabase.from("core_profiles").upsert({
                user_id: user.id,
                ...parsed.profile,
                updated_at: new Date().toISOString(),
            });
        }

        // エピソード保存
        if (parsed.episodes?.length > 0) {
            await supabase.from("episodes").insert(
                parsed.episodes.map((content: string) => ({
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

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.warn("Learn error:", error.message);
        return NextResponse.json({ success: false });
    }
}
