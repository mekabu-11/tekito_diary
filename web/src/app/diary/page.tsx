/**
 * 日記入力ページ（app/diary/page.tsx）
 *
 * アプリのメイン画面。ユーザーが雑なメモを入力し、AIで日記に変換する。
 *
 * === 日記生成フロー ===
 * 1. ユーザーがメモを入力して「AIで日記にする」をタップ
 * 2. 同日の日記が既にあるかチェック → あれば「追記 / 上書き」の選択モーダル表示
 * 3. /api/ai/questions を呼び深掘り質問を生成 → FollowUpForm モーダル表示
 * 4. ユーザーが質問に回答（またはスキップ）
 * 5. /api/ai/format を呼びメモ＋回答を日記に整形
 * 6. Supabase の diaries テーブルに保存
 * 7. /api/ai/learn をバックグラウンドで呼びユーザープロファイルを学習
 * 8. /diary/history にリダイレクト（生成した日記を表示）
 *
 * === 主な機能 ===
 * - 日付選択（前日/翌日切り替え、今日ボタン）
 * - 管理者向けAIモデル選択ドロップダウン
 * - ユーザーコンテキスト（プロフィール＋最近のエピソード）の自動取得
 * - 既存日記との重複検出＆マージ/上書き選択
 */
"use client";

import FollowUpForm from "@/components/FollowUpForm";
import { AI_MODELS, DEFAULT_MODEL } from "@/lib/models";
import { createClient } from "@/lib/supabase";
import { Calendar, ChevronLeft, ChevronRight, Home, Loader2, LogOut, Shield, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// ========== ユーティリティ関数 ==========

/** Date オブジェクトを "YYYY-MM-DD" 形式の文字列に変換する（DBのキーとして使用） */
const toDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Date オブジェクトを日本語の表示日付に変換する（例: "2026年3月20日(金)"） */
const toDisplayDate = (d: Date) =>
    d.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" });

/** Date オブジェクトを短いラベルに変換する（"今日" / "昨日" / "3/20" 等） */
const toDateLabel = (d: Date) => {
    const today = new Date();
    if (toDateKey(d) === toDateKey(today)) return "今日";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (toDateKey(d) === toDateKey(yesterday)) return "昨日";
    return `${d.getMonth() + 1}/${d.getDate()}`;
};

// ========== メインコンポーネント ==========

export default function DiaryPage() {
    const router = useRouter();
    const supabase = createClient();

    // --- 入力・生成関連の状態 ---
    const [text, setText] = useState("");                              // ユーザーが入力したメモ
    const [isLoading, setIsLoading] = useState(false);                // 質問生成中フラグ
    const [selectedDate, setSelectedDate] = useState(new Date());      // 選択中の日付
    const [showFollowUp, setShowFollowUp] = useState(false);          // 深掘り質問モーダルの表示/非表示
    const [questions, setQuestions] = useState<{ question: string; choices: string[] }[]>([]); // AI生成の質問
    const [isGenerating, setIsGenerating] = useState(false);          // 日記生成中フラグ

    // --- ユーザー情報関連の状態 ---
    const [isAdmin, setIsAdmin] = useState(false);                    // 管理者フラグ
    const [displayName, setDisplayName] = useState("");               // 表示名
    const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL); // 選択中のAIモデル
    const [isPageLoading, setIsPageLoading] = useState(true);         // 初期ロード中フラグ

    // --- 重複（コンフリクト）処理関連の状態 ---
    const [pendingMode, setPendingMode] = useState<"new" | "merge" | "replace">("new");       // 保存モード
    const [pendingExisting, setPendingExisting] = useState<{ id: string; original_text: string } | null>(null); // 既存日記データ
    const [showConflictModal, setShowConflictModal] = useState(false); // 重複確認モーダルの表示
    const [conflictData, setConflictData] = useState<{ id: string; original_text: string } | null>(null);      // 重複した既存日記

    // ユーザーコンテキストのキャッシュ（質問生成→日記整形で使いまわすため）
    const cachedUserContextRef = useRef<string>("");
    const dateKey = toDateKey(selectedDate);

    // ========================================
    // 初期化: ページ読み込み時に管理者権限を確認
    // ========================================
    useEffect(() => {
        checkAdmin();
    }, []);

    /** ユーザープロファイルを取得し、管理者かどうかを判定する */
    const checkAdmin = async () => {
        try {
            const res = await fetch("/api/auth/profile");
            if (!res.ok) return;
            const data = await res.json();
            setDisplayName(data.displayName || data.email || "");
            setIsAdmin(data.isAdmin === true);
        } finally {
            setIsPageLoading(false);
        }
    };

    // ========================================
    // ユーザーコンテキスト取得
    // ========================================

    /**
     * AI に渡すユーザーコンテキスト情報を Supabase から取得する
     *
     * - core_profiles: 永続的なプロフィール（性格、人間関係、好みなど）
     * - episodes: 最近のエピソード（直近10件）
     */
    const getUserContext = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return "";

        const [{ data: profile }, { data: episodes }] = await Promise.all([
            supabase.from("core_profiles").select("*").eq("user_id", user.id).single(),
            supabase.from("episodes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
        ]);

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
        return "\n\n" + parts.join("\n\n") + "\n↑この情報は固有名詞・人間関係の理解のためだけに使ってください。この内容を日記本文に含めないでください。";
    };

    // ========================================
    // 日記生成フロー
    // ========================================

    /**
     * ステップ1: 送信ボタンのハンドラ
     */
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

    /**
     * ステップ2: 深掘り質問の生成
     */
    const startGeneration = async (mode: "new" | "merge" | "replace", existing: { id: string; original_text: string } | null) => {
        setPendingMode(mode);
        setPendingExisting(existing);

        setIsLoading(true);
        try {
            const userContext = await getUserContext();
            cachedUserContextRef.current = userContext;

            const res = await fetch("/api/ai/questions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, userContext, model: "gpt-5.4-mini" }),
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

    /**
     * ステップ3: 日記の最終生成＆保存
     */
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
            const userContext = cachedUserContextRef.current || await getUserContext();
            cachedUserContextRef.current = "";

            const res = await fetch("/api/ai/format", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text,
                    currentTime,
                    answers,
                    existingText: mode === "merge" ? existingRec?.original_text : undefined,
                    userContext,
                    model: selectedModel,
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

            const { data: profile } = await supabase.from("core_profiles").select("*").eq("user_id", user.id).single();
            fetch("/api/ai/learn", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    diaryText: data.formatted,
                    originalMemo: text,
                    dateKey,
                    currentProfile: profile || {},
                    model: "gpt-5.4-mini",
                }),
            });

            setText("");
            setShowFollowUp(false);
            router.push(`/diary/history?date=${dateKey}`);
        } catch {
            // エラー時はそのままページに留まる
        } finally {
            setIsGenerating(false);
        }
    };

    // ========================================
    // その他のハンドラ
    // ========================================

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
    };

    const shiftDate = (days: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(d);
    };

    // ========================================
    // レンダリング
    // ========================================

    return (
        <div className="min-h-screen bg-stone-50 dark:bg-slate-900 flex flex-col transition-colors duration-300">
            {/* ===== ヘッダー ===== */}
            <header className="bg-white dark:bg-slate-800 border-b border-stone-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
                <button onClick={() => router.push("/dashboard")} className="text-left group outline-none">
                    <h1 className="text-lg font-extrabold text-slate-800 dark:text-white transition group-hover:text-teal-600 dark:group-hover:text-teal-400">
                        てきとー日記
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 transition group-hover:text-teal-500">
                        ← ダッシュボードに戻る
                    </p>
                </button>
                <div className="flex items-center gap-2">
                    {isPageLoading ? (
                        <Loader2 size={16} className="animate-spin text-slate-300 dark:text-slate-600" />
                    ) : displayName && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium px-2 py-1 bg-stone-100 dark:bg-slate-700 rounded-lg">{displayName}</span>
                    )}
                    {isAdmin && (
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                className="text-xs text-slate-500 dark:text-slate-400 bg-stone-100 dark:bg-slate-700 border border-stone-200 dark:border-slate-600 rounded-lg py-1 px-2 outline-none"
                            >
                                {AI_MODELS.map((m) => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                            </select>
                            <button onClick={() => router.push("/admin")} className="p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition" title="管理画面">
                                <Shield size={18} className="text-amber-500" />
                            </button>
                        </div>
                    )}
                    <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-700 transition">
                        <LogOut size={18} className="text-slate-400 dark:text-slate-500" />
                    </button>
                </div>
            </header>

            <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
                {/* ===== 日付セレクター ===== */}
                <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-stone-100 dark:border-slate-700">
                    <button onClick={() => shiftDate(-1)} className="p-2 rounded-lg bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition">
                        <ChevronLeft size={20} className="text-teal-600 dark:text-teal-400" />
                    </button>
                    <button onClick={() => setSelectedDate(new Date())} className="flex-1 text-center">
                        <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{toDateLabel(selectedDate)}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{toDisplayDate(selectedDate)}</p>
                    </button>
                    <button onClick={() => shiftDate(1)} className="p-2 rounded-lg bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition">
                        <ChevronRight size={20} className="text-teal-600 dark:text-teal-400" />
                    </button>
                </div>

                {/* ===== メモ入力エリア ===== */}
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-stone-100 dark:border-slate-700 p-1">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={"例：朝カフェでモーニング食べた\n昼は会議が3つもあってしんどかった\n帰りにコンビニでアイス買った"}
                        className="w-full min-h-[200px] p-4 text-sm leading-relaxed rounded-xl outline-none resize-none bg-transparent text-slate-800 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                        disabled={isLoading}
                    />
                </div>

                {/* ===== 送信ボタン ===== */}
                <button
                    onClick={handleSubmit}
                    disabled={isLoading || !text.trim()}
                    className="w-full py-4 rounded-xl bg-teal-600 dark:bg-teal-500 text-white font-bold text-sm hover:bg-teal-700 dark:hover:bg-teal-600 transition disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 dark:shadow-teal-500/10"
                >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                    {isLoading ? "質問を生成中..." : "AIで日記にする"}
                </button>

                {/* ===== カレンダー画面へのリンク ===== */}
                <button
                    onClick={() => router.push("/diary/history")}
                    className="w-full py-3 rounded-xl bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 font-bold text-sm hover:bg-teal-100 dark:hover:bg-teal-900/30 transition flex items-center justify-center gap-2 border border-teal-200 dark:border-teal-800"
                >
                    <Calendar size={18} />
                    カレンダーで日記を見る
                </button>
            </div>

            {/* ===== 深掘り質問モーダル ===== */}
            {showFollowUp && (
                <FollowUpForm
                    questions={questions}
                    onSubmit={(a) => finalizeDiary(a)}
                    onSkip={() => finalizeDiary(undefined)}
                    onCancel={() => setShowFollowUp(false)}
                    isLoading={isGenerating}
                />
            )}

            {/* ===== ローディングオーバーレイ ===== */}
            {(isLoading || isGenerating) && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center"
                    style={{ touchAction: "none" }}
                    onClick={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.preventDefault()}
                >
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl text-center space-y-4">
                        <Loader2 size={40} className="animate-spin text-teal-500 mx-auto" />
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            {isLoading ? "深掘り質問を生成中..." : "日記を生成中..."}
                        </p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">少々お待ちください</p>
                    </div>
                </div>
            )}

            {/* ===== 重複確認モーダル ===== */}
            {showConflictModal && conflictData && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl text-center space-y-4">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">この日の日記が既にあります</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">どうしますか？</p>
                        <div className="space-y-2 pt-2">
                            <button onClick={() => { setShowConflictModal(false); startGeneration("merge", conflictData); }} className="w-full py-3 rounded-xl bg-teal-600 dark:bg-teal-500 text-white font-bold text-sm hover:bg-teal-700 dark:hover:bg-teal-600 transition">
                                追記する（マージ）
                            </button>
                            <button onClick={() => { setShowConflictModal(false); startGeneration("replace", conflictData); }} className="w-full py-3 rounded-xl border-2 border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 font-bold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                                上書きする
                            </button>
                            <button onClick={() => setShowConflictModal(false)} className="w-full py-2 text-slate-500 dark:text-slate-400 font-semibold text-sm hover:bg-stone-50 dark:hover:bg-slate-700 rounded-xl transition">
                                やめる（キャンセル）
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
