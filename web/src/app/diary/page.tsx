"use client";
export const dynamic = "force-dynamic";

import FollowUpForm from "@/components/FollowUpForm";
import { createClient } from "@/lib/supabase";
import { Calendar, ChevronLeft, ChevronRight, Loader2, LogOut, Shield, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const toDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const toDisplayDate = (d: Date) =>
    d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });

const toDateLabel = (d: Date) => {
    const today = new Date();
    if (toDateKey(d) === toDateKey(today)) return "今日";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (toDateKey(d) === toDateKey(yesterday)) return "昨日";
    return `${d.getMonth() + 1}/${d.getDate()}`;
};

export default function DiaryPage() {
    const router = useRouter();
    const supabase = createClient();
    const [text, setText] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showFollowUp, setShowFollowUp] = useState(false);
    const [questions, setQuestions] = useState<{ question: string; choices: string[] }[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [displayName, setDisplayName] = useState("");
    const [pendingMode, setPendingMode] = useState<"new" | "merge" | "replace">("new");
    const [pendingExisting, setPendingExisting] = useState<{ id: string; original_text: string } | null>(null);
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [conflictData, setConflictData] = useState<{ id: string; original_text: string } | null>(null);
    const dateKey = toDateKey(selectedDate);

    useEffect(() => {
        checkAdmin();
    }, []);

    const checkAdmin = async () => {
        const res = await fetch("/api/auth/profile");
        if (!res.ok) return;
        const data = await res.json();
        setDisplayName(data.displayName || data.email || "");
        setIsAdmin(data.isAdmin === true);
    };

    const getUserContext = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return "";

        const { data: profile } = await supabase.from("core_profiles").select("*").eq("user_id", user.id).single();
        const { data: episodes } = await supabase.from("episodes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10);

        const parts: string[] = [];
        if (profile) {
            const sections: string[] = [];
            if (profile.personality?.length) sections.push(`性格・趣味: ${profile.personality.join("、")}`);
            if (profile.people?.length) sections.push(`人間関係: ${profile.people.join("、")}`);
            if (profile.places?.length) sections.push(`よく行く場所: ${profile.places.join("、")}`);
            if (profile.work?.length) sections.push(`仕事: ${profile.work.join("、")}`);
            if (profile.lifestyle?.length) sections.push(`生活習慣: ${profile.lifestyle.join("、")}`);
            if (profile.preferences?.length) sections.push(`好み: ${profile.preferences.join("、")}`);
            if (sections.length) parts.push(`【この人のプロフィール】\n${sections.join("\n")}`);
        }
        if (episodes?.length) {
            parts.push(`【最近のできごと】\n${episodes.map((e) => `- [${e.date}] ${e.content}`).join("\n")}`);
        }
        if (!parts.length) return "";
        return "\n\n" + parts.join("\n\n") + "\n↑この情報を参考にしてください。ただし無理に使わなくてよいです。";
    };

    const handleSubmit = async () => {
        if (!text.trim()) return;
        setIsLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setIsLoading(false);
            return;
        }

        const { data: existing } = await supabase
            .from("diaries").select("*").eq("user_id", user.id).eq("date", dateKey).maybeSingle();

        if (existing) {
            setIsLoading(false);
            setConflictData(existing);
            setShowConflictModal(true);
        } else {
            startGeneration("new", null);
        }
    };

    const startGeneration = async (mode: "new" | "merge" | "replace", existing: { id: string; original_text: string } | null) => {
        setPendingMode(mode);
        setPendingExisting(existing);

        // 深掘り質問生成
        setIsLoading(true);
        try {
            const userContext = await getUserContext();
            const res = await fetch("/api/gemini/questions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, userContext }),
            });
            const data = await res.json();
            if (data.questions?.length > 0) {
                setQuestions(data.questions);
                setShowFollowUp(true);
            } else {
                await finalizeDiary(undefined, mode, existing);
            }
        } catch {
            await finalizeDiary(undefined, mode, existing);
        } finally {
            setIsLoading(false);
        }
    };

    const finalizeDiary = async (
        answers?: { question: string; answer: string }[],
        modeFallback?: "new" | "merge" | "replace",
        existingFallback?: { id: string; original_text: string } | null
    ) => {
        setIsGenerating(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const mode = modeFallback !== undefined ? modeFallback : pendingMode;
            const existingRec = existingFallback !== undefined ? existingFallback : pendingExisting;

            const now = new Date();
            const currentTime = `${now.getHours()}時${now.getMinutes()}分`;
            const userContext = await getUserContext();

            const res = await fetch("/api/gemini/format", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text,
                    currentTime,
                    answers,
                    existingText: mode === "merge" ? existingRec?.original_text : undefined,
                    userContext,
                }),
            });
            const data = await res.json();
            if (!data.formatted) throw new Error(data.error || "整形に失敗しました");

            const originalText = mode === "merge" && existingRec
                ? existingRec.original_text + "\n" + text
                : text;

            if (existingRec) {
                await supabase.from("diaries").update({
                    original_text: originalText,
                    formatted_text: data.formatted,
                    display_date: toDisplayDate(selectedDate),
                    updated_at: new Date().toISOString(),
                }).eq("id", existingRec.id);
            } else {
                await supabase.from("diaries").insert({
                    user_id: user.id,
                    date: dateKey,
                    display_date: toDisplayDate(selectedDate),
                    original_text: originalText,
                    formatted_text: data.formatted,
                });
            }

            // バックグラウンドで学習
            const { data: profile } = await supabase.from("core_profiles").select("*").eq("user_id", user.id).single();
            fetch("/api/gemini/learn", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    diaryText: data.formatted,
                    originalMemo: text,
                    dateKey,
                    currentProfile: profile || {},
                }),
            });

            setText("");
            setShowFollowUp(false);
            router.push(`/diary/history?date=${dateKey}`);
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : "予期しないエラーが発生しました";
            alert(errorMessage);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
    };

    const shiftDate = (days: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(d);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
                <h1 className="text-lg font-extrabold text-gray-900">てきとー日記</h1>
                <div className="flex items-center gap-2">
                    {displayName && (
                        <span className="text-xs text-gray-500 font-medium px-2 py-1 bg-gray-50 rounded-lg">{displayName}</span>
                    )}
                    {isAdmin && (
                        <button onClick={() => router.push("/admin")} className="p-2 rounded-lg hover:bg-amber-50 transition" title="管理画面">
                            <Shield size={18} className="text-amber-500" />
                        </button>
                    )}
                    <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-gray-100 transition">
                        <LogOut size={18} className="text-gray-500" />
                    </button>
                </div>
            </header>

            <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
                {/* Date Selector */}
                <div className="flex items-center bg-white rounded-2xl p-3 shadow-sm">
                    <button onClick={() => shiftDate(-1)} className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition">
                        <ChevronLeft size={20} className="text-emerald-500" />
                    </button>
                    <button onClick={() => setSelectedDate(new Date())} className="flex-1 text-center">
                        <p className="text-xl font-extrabold text-gray-900">{toDateLabel(selectedDate)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{toDisplayDate(selectedDate)}</p>
                    </button>
                    <button onClick={() => shiftDate(1)} className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition">
                        <ChevronRight size={20} className="text-emerald-500" />
                    </button>
                </div>

                {/* Input */}
                <div className="bg-white rounded-2xl shadow-sm p-1">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={"例：朝カフェでモーニング食べた\n昼は会議が3つもあってしんどかった\n帰りにコンビニでアイス買った"}
                        className="w-full min-h-[200px] p-4 text-sm leading-relaxed rounded-2xl outline-none resize-none placeholder:text-gray-300"
                        disabled={isLoading}
                    />
                </div>

                {/* Submit */}
                <button
                    onClick={handleSubmit}
                    disabled={isLoading || !text.trim()}
                    className="w-full py-4 rounded-2xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                    {isLoading ? "質問を生成中..." : "AIで日記にする"}
                </button>

                {/* History */}
                <button
                    onClick={() => router.push("/diary/history")}
                    className="w-full py-3 rounded-xl bg-emerald-50 text-emerald-600 font-bold text-sm hover:bg-emerald-100 transition flex items-center justify-center gap-2"
                >
                    <Calendar size={18} />
                    カレンダーで日記を見る
                </button>
            </div>

            {/* Follow-up modal */}
            {showFollowUp && (
                <FollowUpForm
                    questions={questions}
                    onSubmit={(a) => finalizeDiary(a)}
                    onSkip={() => finalizeDiary(undefined)}
                    onCancel={() => setShowFollowUp(false)}
                    isLoading={isGenerating}
                />
            )}

            {/* Conflict Modal */}
            {showConflictModal && conflictData && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl text-center space-y-4">
                        <h3 className="text-lg font-bold text-gray-900">この日の日記が既にあります</h3>
                        <p className="text-sm text-gray-500">どうしますか？</p>
                        <div className="space-y-2 pt-2">
                            <button onClick={() => { setShowConflictModal(false); startGeneration("merge", conflictData); }} className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition">
                                追記する（マージ）
                            </button>
                            <button onClick={() => { setShowConflictModal(false); startGeneration("replace", conflictData); }} className="w-full py-3 rounded-xl border-2 border-red-100 text-red-500 font-bold text-sm hover:bg-red-50 transition">
                                上書きする
                            </button>
                            <button onClick={() => setShowConflictModal(false)} className="w-full py-2 text-gray-500 font-semibold text-sm hover:bg-gray-50 rounded-xl transition">
                                やめる（キャンセル）
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
