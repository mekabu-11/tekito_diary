/**
 * TODO抽出 API
 *
 * エンドポイント: POST /api/ai/todos
 *
 * 日記テキストからAIがTODO候補を抽出し、todos テーブルに保存する。
 * 既に同じ diary_date のTODOが存在する場合は削除してから再挿入（日記更新時の再抽出に対応）。
 *
 * リクエストボディ:
 * - diaryText: AI が整形した日記テキスト
 * - dateKey: 日付キー（例: "2026-03-20"）
 * - model: 使用する AI モデル名（任意）
 */
import { extractJsonObject } from "@/lib/parse-ai-json";
import { createServerSupabase } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

export async function POST(request: NextRequest) {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { diaryText, dateKey, model } = await request.json();

    const prompt = `以下の日記を読んで、この人がやるべきこと・やろうとしていること・やりたいことをTODOとして抽出してください。

抽出基準：
- 「〜しなければ」「〜する予定」「〜しようと思う」「〜したい」「〜しないと」のような表現
- 具体的なタスクや行動（抽象的な感想はTODOにしない）
- 明らかにもう完了している行動はTODOにしない

存在しない場合は空配列を返してください。TODOは短く簡潔に書いてください（10〜30文字程度）。

必ず以下のJSON形式のみで回答してください：
{"todos":["タスク1","タスク2"]}

日記：
${diaryText}`;

    try {
        const result = await openai.chat.completions.create({
            model: model || "gpt-5.4-mini",
            messages: [{ role: "user", content: prompt }],
        });
        const raw = (result.choices[0].message.content || "").trim();
        const parsed = extractJsonObject(raw);
        if (!parsed) return NextResponse.json({ success: true, todos: [] });
        const todos: string[] = (parsed.todos as string[]) || [];

        // 同日のTODOを一旦削除してから再挿入
        await supabase.from("todos").delete().eq("user_id", user.id).eq("diary_date", dateKey);

        if (todos.length > 0) {
            await supabase.from("todos").insert(
                todos.map((content) => ({
                    user_id: user.id,
                    content,
                    diary_date: dateKey,
                }))
            );
        }

        return NextResponse.json({ success: true, todos });
    } catch (error: unknown) {
        console.error("TODO extract error:", error);
        const errorMessage = error instanceof Error ? error.message : "TODO抽出エラー";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
