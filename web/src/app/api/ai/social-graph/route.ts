/**
 * 人間関係グラフ API（/api/ai/social-graph）
 *
 * エンドポイント: POST /api/ai/social-graph
 *
 * core_profiles の people 配列と全日記テキストを AI に渡し、
 * 人物ごとの関係性・出現頻度・気分相関・エピソードを抽出する。
 * ダッシュボードの「人間関係グラフ」画面で使用する。
 *
 * レスポンス:
 *   { people: SocialNode[] }
 */
import { extractJsonArray } from "@/lib/parse-ai-json";
import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

export async function POST(request: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        // コアプロファイルの people 配列を取得
        const { data: profile } = await supabase
            .from("core_profiles")
            .select("people")
            .eq("user_id", user.id)
            .single();

        // 直近の日記を取得（最大30件で十分なコンテキスト）
        const { data: diaries } = await supabase
            .from("diaries")
            .select("date, formatted_text")
            .eq("user_id", user.id)
            .order("date", { ascending: false })
            .limit(30);

        const peopleList = profile?.people || [];
        if (peopleList.length === 0 && (!diaries || diaries.length === 0)) {
            return NextResponse.json({ people: [] });
        }

        // 日記テキストを日付付きで連結
        const diaryContext = (diaries || [])
            .map((d) => `【${d.date}】${d.formatted_text}`)
            .join("\n\n");

        const prompt = `以下の日記に登場する人物について分析してください。
既知の人物リスト: ${JSON.stringify(peopleList)}

各人物について以下の情報を JSON 配列で返してください:
- name: 人物名
- relation: 関係性（"家族", "友人", "同僚", "恋人", "知人" のいずれか）
- lastSeen: 最後に日記に登場した日付（YYYY-MM-DD形式）
- frequency: 日記での登場回数（数値）
- moodImpact: その人といる時の気分傾向（"positive", "neutral", "negative"）
- episodes: その人に関するエピソード要約（最大3件、文字列の配列）
- suggestion: AIからの提案（例: "最近会っていません。連絡してみませんか？"）

人物リストにいなくても日記に名前で登場する人物は含めてください。
必ず JSON 配列のみで回答してください。人物がいない場合は空配列 [] を返してください。

日記:
${diaryContext}`;

        const result = await openai.chat.completions.create({
            model: "gpt-5.4-mini",
            messages: [{ role: "user", content: prompt }],
        });

        const raw = (result.choices[0].message.content || "").trim();
        const parsed = extractJsonArray(raw);

        return NextResponse.json({ people: parsed || [] });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "分析エラー";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
