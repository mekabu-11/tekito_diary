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
import { Calendar, ChevronLeft, ChevronRight, Loader2, LogOut, Shield, Sparkles } from "lucide-react";
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
     *
     * この情報は日記の整形時に AI に渡され、固有名詞や人間関係を
     * 正しく理解した日記を生成するために使われる。
     * ※ 日記本文に含めないよう AI に指示する注意書きも付加する
     */
    const getUserContext = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return "";

        // プロフィールとエピソードを並行取得
        const [{ data: profile }, { data: episodes }] = await Promise.all([
            supabase.from("core_profiles").select("*").eq("user_id", user.id).single(),
            supabase.from("episodes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
        ]);

        // プロフィール情報を整形
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
        // エピソード情報を整形（日付付き）
        if (episodes?.length) {
            parts.push(`【最近のできごと】\n${episodes.map((e) => `- [${e.date}] ${e.content}`).join("\n")}`);
        }
        if (!parts.length) return "";
        // AI への注意書き: この情報は理解のためのみ使い、日記本文に含めない
        return "\n\n" + parts.join("\n\n") + "\n↑この情報は固有名詞・人間関係の理解のためだけに使ってください。この内容を日記本文に含めないでください。";
    };

    // ========================================
    // 日記生成フロー
    // ========================================

    /**
     * ステップ1: 送信ボタンのハンドラ
     *
     * 同日の日記が既にあるかチェックし、
     * - ある場合: コンフリクトモーダルを表示（追記/上書き/キャンセル）
     * - ない場合: そのまま生成フローへ進む
     */
    const handleSubmit = async () => {
        if (!text.trim()) return;
        setIsLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setIsLoading(false);
            return;
        }

        // 同じユーザー・同じ日付の日記が既に存在するかチェック
        const { data: existing } = await supabase
            .from("diaries").select("*").eq("user_id", user.id).eq("date", dateKey).maybeSingle();

        if (existing) {
            // 既に日記がある → コンフリクトモーダルを表示
            setIsLoading(false);
            setConflictData(existing);
            setShowConflictModal(true);
        } else {
            // 新規作成 → 深掘り質問の生成へ
            startGeneration("new", null);
        }
    };

    /**
     * ステップ2: 深掘り質問の生成
     *
     * メモの内容に基づいて AI が質問を生成し、FollowUpForm モーダルを表示する。
     * 質問がない場合（メモが十分詳しい場合）はスキップして直接日記を生成する。
     *
     * @param mode - 保存モード（"new": 新規, "merge": 追記, "replace": 上書き）
     * @param existing - 既存の日記データ（追記/上書き時に使用）
     */
    const startGeneration = async (mode: "new" | "merge" | "replace", existing: { id: string; original_text: string } | null) => {
        setPendingMode(mode);
        setPendingExisting(existing);

        setIsLoading(true);
        try {
            // ユーザーコンテキストを取得してキャッシュ（日記整形時にも使いまわす）
            const userContext = await getUserContext();
            cachedUserContextRef.current = userContext;

            // AI に深掘り質問を生成させる（コスト節約のため常に gpt-5.4-mini を使用）
            const res = await fetch("/api/ai/questions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, userContext, model: "gpt-5.4-mini" }),
            });
            const data = await res.json();

            if (data.questions?.length > 0) {
                // 質問がある → FollowUpForm モーダルを表示
                setQuestions(data.questions);
                setShowFollowUp(true);
            } else {
                // 質問なし → スキップして直接日記を生成
                await finalizeDiary(undefined, mode, existing);
            }
        } catch {
            // 質問生成に失敗しても、日記生成自体は続行
            await finalizeDiary(undefined, mode, existing);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * ステップ3: 日記の最終生成＆保存
     *
     * メモ＋深掘り回答を AI で日記に整形し、Supabase に保存する。
     * 保存後はバックグラウンドでユーザープロファイルの学習を実行する。
     *
     * @param answers - 深掘り質問への回答（スキップ時は undefined）
     * @param modeFallback - 呼び出し元から直接渡されるモード（FollowUpForm 経由でない場合用）
     * @param existingFallback - 呼び出し元から直接渡される既存日記データ
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

            // FollowUpForm から呼ばれた場合は state から、直接呼ばれた場合は引数からモードを取得
            const mode = modeFallback !== undefined ? modeFallback : pendingMode;
            const existingRec = existingFallback !== undefined ? existingFallback : pendingExisting;

            // 現在時刻を取得（AI が時間帯を推測するためのヒント）
            const now = new Date();
            const currentTime = `${now.getHours()}時${now.getMinutes()}分`;
            const userContext = cachedUserContextRef.current || await getUserContext();
            cachedUserContextRef.current = "";

            // AI でメモを日記に整形
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

            // マージモードの場合、元メモを結合する
            const originalText = mode === "merge" && existingRec
                ? existingRec.original_text + "\n" + text
                : text;

            // Supabase に日記を保存（既存があれば update、なければ insert）
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

            // バックグラウンドでユーザープロファイル学習（await しない＝レスポンスを待たない）
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

            // 入力をクリアして履歴ページに遷移
            setText("");
            setShowFollowUp(false);
            router.push(`/diary/history?date=${dateKey}`);
        } catch {
            // エラー時はそのままページに留まる（isGenerating が false に戻る）
        } finally {
            setIsGenerating(false);
        }
    };

    // ========================================
    // その他のハンドラ
    // ========================================

    /** ログアウト処理: セッションを破棄してログインページに遷移 */
    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
    };

    /** 日付を前後にシフトする（-1: 前日, +1: 翌日） */
    const shiftDate = (days: number) => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + days);
        setSelectedDate(d);
    };

    // ========================================
    // レンダリング
    // ========================================

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* ===== ヘッダー: アプリ名、ユーザー名、管理者メニュー、ログアウト ===== */}
            <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
                <h1 className="text-lg font-extrabold text-gray-900">てきとー日記</h1>
                <div className="flex items-center gap-2">
                    {/* ユーザー表示名 */}
                    {isPageLoading ? (
                        <Loader2 size={16} className="animate-spin text-gray-300" />
                    ) : displayName && (
                        <span className="text-xs text-gray-500 font-medium px-2 py-1 bg-gray-50 rounded-lg">{displayName}</span>
                    )}
                    {/* 管理者限定: AIモデル選択 & 管理画面リンク */}
                    {isAdmin && (
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedModel}
                                onChange={(e) => setSelectedModel(e.target.value)}
                                className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg py-1 px-2 outline-none"
                            >
                                {AI_MODELS.map((m) => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                            </select>
                            <button onClick={() => router.push("/admin")} className="p-2 rounded-lg hover:bg-amber-50 transition" title="管理画面">
                                <Shield size={18} className="text-amber-500" />
                            </button>
                        </div>
                    )}
                    {/* ログアウトボタン */}
                    <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-gray-100 transition">
                        <LogOut size={18} className="text-gray-500" />
                    </button>
                </div>
            </header>

            <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
                {/* ===== 日付セレクター: 矢印で前日/翌日、中央タップで今日に戻る ===== */}
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

                {/* ===== メモ入力エリア ===== */}
                <div className="bg-white rounded-2xl shadow-sm p-1">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder={"例：朝カフェでモーニング食べた\n昼は会議が3つもあってしんどかった\n帰りにコンビニでアイス買った"}
                        className="w-full min-h-[200px] p-4 text-sm leading-relaxed rounded-2xl outline-none resize-none placeholder:text-gray-300"
                        disabled={isLoading}
                    />
                </div>

                {/* ===== 送信ボタン: AIで日記にする ===== */}
                <button
                    onClick={handleSubmit}
                    disabled={isLoading || !text.trim()}
                    className="w-full py-4 rounded-2xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                    {isLoading ? "質問を生成中..." : "AIで日記にする"}
                </button>

                {/* ===== カレンダー画面へのリンクボタン ===== */}
                <button
                    onClick={() => router.push("/diary/history")}
                    className="w-full py-3 rounded-xl bg-emerald-50 text-emerald-600 font-bold text-sm hover:bg-emerald-100 transition flex items-center justify-center gap-2"
                >
                    <Calendar size={18} />
                    カレンダーで日記を見る
                </button>
            </div>

            {/* ===== 深掘り質問モーダル（FollowUpForm コンポーネント） ===== */}
            {showFollowUp && (
                <FollowUpForm
                    questions={questions}
                    onSubmit={(a) => finalizeDiary(a)}
                    onSkip={() => finalizeDiary(undefined)}
                    onCancel={() => setShowFollowUp(false)}
                    isLoading={isGenerating}
                />
            )}

            {/* ===== ローディングオーバーレイ: 質問生成中 or 日記生成中に全操作をブロック ===== */}
            {(isLoading || isGenerating) && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center"
                    style={{ touchAction: "none" }}
                    onClick={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.preventDefault()}
                >
                    <div className="bg-white rounded-3xl p-8 shadow-xl text-center space-y-4">
                        <Loader2 size={40} className="animate-spin text-emerald-500 mx-auto" />
                        <p className="text-sm font-bold text-gray-700">
                            {isLoading ? "深掘り質問を生成中..." : "日記を生成中..."}
                        </p>
                        <p className="text-xs text-gray-400">少々お待ちください</p>
                    </div>
                </div>
            )}

            {/* ===== 重複確認モーダル: 同日の日記が既にある場合の選択肢 ===== */}
            {showConflictModal && conflictData && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl text-center space-y-4">
                        <h3 className="text-lg font-bold text-gray-900">この日の日記が既にあります</h3>
                        <p className="text-sm text-gray-500">どうしますか？</p>
                        <div className="space-y-2 pt-2">
                            {/* 追記（マージ）: 既存メモと新しいメモを統合して日記を再生成 */}
                            <button onClick={() => { setShowConflictModal(false); startGeneration("merge", conflictData); }} className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition">
                                追記する（マージ）
                            </button>
                            {/* 上書き: 既存メモを無視して新しいメモだけで日記を生成 */}
                            <button onClick={() => { setShowConflictModal(false); startGeneration("replace", conflictData); }} className="w-full py-3 rounded-xl border-2 border-red-100 text-red-500 font-bold text-sm hover:bg-red-50 transition">
                                上書きする
                            </button>
                            {/* キャンセル: 何もせずモーダルを閉じる */}
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
