/**
 * ダッシュボードコンテンツ（DashboardContent）
 *
 * ログイン後に最初に表示されるダッシュボード画面の本体。
 * 各種カード型UIでユーザーの日記活動を可視化し、
 * モチベーションを高める情報ハブとして機能する。
 *
 * === 表示セクション ===
 * 1. ヘッダー（挨拶 + テーマ切替 + ナビ）
 * 2. 今日の日記ステータス
 * 3. ミニカレンダー（今月）
 * 4. 月間統計サマリー
 * 5. 気分トレンドグラフ（AI）
 * 6. 今日の一言コメント（AI）
 * 7. 週間振り返りレポート（AI）
 * 8. ランダム過去日記ピックアップ
 * 9. フッターナビ
 */
"use client";

import MiniCalendar from "@/components/MiniCalendar";
import MoodChart from "@/components/MoodChart";
import { useTheme } from "@/components/ThemeProvider";
import { createClient } from "@/lib/supabase";
import {
    BarChart3,
    BookOpen,
    Bookmark,
    Calendar,
    ChevronDown,
    ChevronUp,
    Loader2,
    LogOut,
    MessageCircle,
    Moon,
    PenLine,
    Settings2,
    Shield,
    Shuffle,
    Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// ========== 型定義 ==========

interface Diary {
    id: string;
    date: string;
    display_date: string;
    original_text: string;
    formatted_text: string;
}

// ========== ユーティリティ関数 ==========

/** Date を "YYYY-MM-DD" 形式に変換 */
const toDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** 時間帯に応じた挨拶メッセージを返す */
function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return "おはようございます";
    if (hour >= 11 && hour < 17) return "こんにちは";
    if (hour >= 17 && hour < 21) return "お疲れ様です";
    return "おやすみ前のひととき";
}

/** 先週の月〜日の日付範囲を取得する */
function getLastWeekRange(): { start: Date; end: Date } {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const lastSunday = new Date(today);
    lastSunday.setDate(today.getDate() - dayOfWeek);
    const lastMonday = new Date(lastSunday);
    lastMonday.setDate(lastSunday.getDate() - 6);
    return { start: lastMonday, end: lastSunday };
}

// ========== ローカルストレージキャッシュヘルパー ==========

function getCachedData<T>(key: string, dateKey: string): T | null {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed.dateKey === dateKey) return parsed.data as T;
    } catch { /* ignore */ }
    return null;
}

function setCachedData<T>(key: string, dateKey: string, data: T): void {
    localStorage.setItem(key, JSON.stringify({ dateKey, data }));
}

// ========== メインコンポーネント ==========

export default function DashboardContent() {
    const router = useRouter();
    const supabase = createClient();
    const { theme, toggleTheme } = useTheme();

    // --- 基本データ ---
    const [isLoading, setIsLoading] = useState(true);
    const [displayName, setDisplayName] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [diaries, setDiaries] = useState<Diary[]>([]);
    const [diaryDates, setDiaryDates] = useState<Set<string>>(new Set());

    // --- AI生成コンテンツ ---
    const [moodData, setMoodData] = useState<{ date: string; score: number }[]>([]);
    const [isMoodLoading, setIsMoodLoading] = useState(false);
    const [aiComment, setAiComment] = useState("");
    const [isCommentLoading, setIsCommentLoading] = useState(false);
    const [weeklyReport, setWeeklyReport] = useState("");
    const [isReportLoading, setIsReportLoading] = useState(false);

    // --- ランダム日記 ---
    const [randomDiary, setRandomDiary] = useState<Diary | null>(null);

    // --- 並べ替え状態 ---
    const [isEditMode, setIsEditMode] = useState(false);
    const [sectionOrder, setSectionOrder] = useState<string[]>([
        "calendar", "stats", "mood", "comment", "report", "random"
    ]);

    const todayKey = toDateKey(new Date());
    const greeting = getGreeting();

    // ========================================
    // 初期化
    // ========================================

    useEffect(() => {
        const savedOrder = localStorage.getItem("dashboard_layout");
        if (savedOrder) {
            try {
                setSectionOrder(JSON.parse(savedOrder));
            } catch { /* ignore */ }
        }
        loadInitialData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadInitialData = async () => {
        setIsLoading(true);
        try {
            const profileRes = await fetch("/api/auth/profile");
            if (profileRes.ok) {
                const profile = await profileRes.json();
                setDisplayName(profile.displayName || profile.email || "");
                setIsAdmin(profile.isAdmin === true);
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from("diaries")
                .select("*")
                .eq("user_id", user.id)
                .order("date", { ascending: false });

            if (data) {
                setDiaries(data);
                setDiaryDates(new Set(data.map((d) => d.date)));
                pickRandomDiary(data);
                loadAIData(data);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ========================================
    // AI データ取得
    // ========================================

    const loadAIData = async (allDiaries: Diary[]) => {
        const recent7 = allDiaries.slice(0, 7).reverse();
        if (recent7.length >= 1) {
            loadMoodData(recent7);
        }

        const recent3 = allDiaries.slice(0, 3);
        if (recent3.length > 0) {
            loadComment(recent3);
        }

        const { start, end } = getLastWeekRange();
        const startKey = toDateKey(start);
        const endKey = toDateKey(end);
        const lastWeekDiaries = allDiaries.filter((d) => d.date >= startKey && d.date <= endKey);
        if (lastWeekDiaries.length >= 2) {
            loadWeeklyReport(lastWeekDiaries, startKey);
        }
    };

    const loadMoodData = async (recentDiaries: Diary[]) => {
        const cacheKey = "dashboard_mood";
        const cached = getCachedData<{ date: string; score: number }[]>(cacheKey, todayKey);
        if (cached) {
            setMoodData(cached);
            return;
        }

        setIsMoodLoading(true);
        try {
            const res = await fetch("/api/ai/mood", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    texts: recentDiaries.map((d) => ({ date: d.date, text: d.formatted_text })),
                }),
            });
            const data = await res.json();
            if (data.scores?.length) {
                setMoodData(data.scores);
                setCachedData(cacheKey, todayKey, data.scores);
            }
        } catch { /* ignore */ }
        finally { setIsMoodLoading(false); }
    };

    const loadComment = async (recentDiaries: Diary[]) => {
        const cacheKey = "dashboard_comment";
        const cached = getCachedData<string>(cacheKey, todayKey);
        if (cached) {
            setAiComment(cached);
            return;
        }

        setIsCommentLoading(true);
        try {
            const res = await fetch("/api/ai/comment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    texts: recentDiaries.map((d) => d.formatted_text),
                }),
            });
            const data = await res.json();
            if (data.comment) {
                setAiComment(data.comment);
                setCachedData(cacheKey, todayKey, data.comment);
            }
        } catch { /* ignore */ }
        finally { setIsCommentLoading(false); }
    };

    const loadWeeklyReport = async (lastWeekDiaries: Diary[], weekKey: string) => {
        const cacheKey = "dashboard_weekly";
        const cached = getCachedData<string>(cacheKey, weekKey);
        if (cached) {
            setWeeklyReport(cached);
            return;
        }

        setIsReportLoading(true);
        try {
            const res = await fetch("/api/ai/weekly-report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    texts: lastWeekDiaries.map((d) => ({ date: d.date, text: d.formatted_text })),
                }),
            });
            const data = await res.json();
            if (data.report) {
                setWeeklyReport(data.report);
                setCachedData(cacheKey, weekKey, data.report);
            }
        } catch { /* ignore */ }
        finally { setIsReportLoading(false); }
    };

    // ========================================
    // ランダム日記ピックアップ
    // ========================================

    const pickRandomDiary = (allDiaries: Diary[]) => {
        if (allDiaries.length < 5) {
            setRandomDiary(null);
            return;
        }

        const today = new Date();
        const candidates = [365, 182, 91].map((offset) => {
            const d = new Date(today);
            d.setDate(d.getDate() - offset);
            return toDateKey(d);
        });

        for (const dateKey of candidates) {
            const found = allDiaries.find((d) => d.date === dateKey);
            if (found) {
                setRandomDiary(found);
                return;
            }
        }

        const pastDiaries = allDiaries.filter((d) => d.date !== todayKey);
        if (pastDiaries.length > 0) {
            const idx = Math.floor(Math.random() * pastDiaries.length);
            setRandomDiary(pastDiaries[idx]);
        }
    };

    const shuffleRandomDiary = () => {
        const pastDiaries = diaries.filter((d) => d.date !== todayKey);
        if (pastDiaries.length > 0) {
            const idx = Math.floor(Math.random() * pastDiaries.length);
            setRandomDiary(pastDiaries[idx]);
        }
    };

    // ========================================
    // その他ハンドラ
    // ========================================

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
    };

    // ========================================
    // 並べ替え・表示ハンドラ
    // ========================================

    const moveSection = (idx: number, direction: -1 | 1) => {
        if (idx + direction < 0 || idx + direction >= sectionOrder.length) return;
        const newOrder = [...sectionOrder];
        const temp = newOrder[idx];
        newOrder[idx] = newOrder[idx + direction];
        newOrder[idx + direction] = temp;
        setSectionOrder(newOrder);
        localStorage.setItem("dashboard_layout", JSON.stringify(newOrder));
    };

    const renderSection = (key: string) => {
        switch (key) {
            case "calendar":
                return <MiniCalendar diaryDates={diaryDates} onDateClick={(dateKey) => router.push(`/diary/history?date=${dateKey}`)} />;
            case "stats":
                return (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-stone-100 dark:border-slate-700">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5">
                            <BarChart3 size={15} className="text-teal-500" />
                            今月の統計
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3 text-center">
                                <p className="text-2xl font-extrabold text-teal-700 dark:text-teal-300">
                                    {thisMonthDiaries.length}
                                    <span className="text-sm font-medium text-slate-400 dark:text-slate-500">
                                        /{daysElapsed}日
                                    </span>
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">記録日数</p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                                <p className="text-2xl font-extrabold text-blue-700 dark:text-blue-300">
                                    {totalChars.toLocaleString()}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">総文字数</p>
                            </div>
                        </div>
                    </div>
                );
            case "mood":
                return <MoodChart data={moodData} isLoading={isMoodLoading} />;
            case "comment":
                if (!isCommentLoading && !aiComment) return null;
                return (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-stone-100 dark:border-slate-700">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                            <MessageCircle size={15} className="text-teal-500" />
                            AIからの一言
                        </h3>
                        {isCommentLoading ? (
                            <div className="flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin text-slate-400" />
                                <span className="text-xs text-slate-400">考え中...</span>
                            </div>
                        ) : (
                            <div className="bg-teal-50 dark:bg-teal-900/15 rounded-lg p-3">
                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                    {aiComment}
                                </p>
                            </div>
                        )}
                    </div>
                );
            case "report":
                if (!isReportLoading && !weeklyReport) return null;
                return (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-stone-100 dark:border-slate-700">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                            <BookOpen size={15} className="text-teal-500" />
                            先週の振り返り
                        </h3>
                        {isReportLoading ? (
                            <div className="flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin text-slate-400" />
                                <span className="text-xs text-slate-400">レポートを生成中...</span>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                {weeklyReport}
                            </p>
                        )}
                    </div>
                );
            case "random":
                if (!randomDiary) return null;
                return (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-stone-100 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                <Bookmark size={15} className="text-amber-500" />
                                過去の日記ピックアップ
                            </h3>
                            <button
                                onClick={shuffleRandomDiary}
                                className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-700 transition"
                                title="シャッフル"
                            >
                                <Shuffle size={14} className="text-slate-400" />
                            </button>
                        </div>
                        <div
                            onClick={() => router.push(`/diary/history?date=${randomDiary.date}`)}
                            className="bg-amber-50 dark:bg-amber-900/15 rounded-lg p-3 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/25 transition"
                        >
                            <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mb-1">
                                {randomDiary.display_date}
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3">
                                {randomDiary.formatted_text.slice(0, 100)}
                                {randomDiary.formatted_text.length > 100 ? "..." : ""}
                            </p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-semibold">
                                続きを見る →
                            </p>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    // ========================================
    // 統計データ計算
    // ========================================

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thisMonthDiaries = diaries.filter((d) => {
        const [y, m] = d.date.split("-").map(Number);
        return y === currentYear && m === currentMonth + 1;
    });
    const daysElapsed = now.getDate();
    const totalChars = thisMonthDiaries.reduce((sum, d) => sum + d.formatted_text.length, 0);
    const todayDiary = diaries.find((d) => d.date === todayKey);

    // ========================================
    // レンダリング
    // ========================================

    if (isLoading) {
        return (
            <div className="min-h-screen bg-stone-50 dark:bg-slate-900 flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-teal-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-stone-50 dark:bg-slate-900 flex flex-col transition-colors duration-300">
            {/* ===== ヘッダー: タイトル左端 ===== */}
            <header className="bg-white dark:bg-slate-800 border-b border-stone-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-extrabold text-slate-800 dark:text-white">てきとー日記</h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {greeting}{displayName ? `、${displayName}さん` : ""}
                    </p>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-700 transition"
                        title={theme === "dark" ? "ライトモード" : "ダークモード"}
                    >
                        {theme === "dark" ? (
                            <Sun size={18} className="text-amber-400" />
                        ) : (
                            <Moon size={18} className="text-slate-500" />
                        )}
                    </button>
                    <button
                        onClick={() => setIsEditMode((prev) => !prev)}
                        className={`p-2 rounded-lg transition ${isEditMode ? "bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400" : "hover:bg-stone-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500"}`}
                        title="ダッシュボードの並べ替え"
                    >
                        <Settings2 size={18} />
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => router.push("/admin")}
                            className="p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition"
                            title="管理画面"
                        >
                            <Shield size={18} className="text-amber-500" />
                        </button>
                    )}
                    <button
                        onClick={handleLogout}
                        className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-700 transition"
                    >
                        <LogOut size={18} className="text-slate-400 dark:text-slate-500" />
                    </button>
                </div>
            </header>

            {/* ===== メインコンテンツ ===== */}
            <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">

                {/* --- アクションボタン（一番上、並べ替え対象外） --- */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => router.push("/diary")}
                        className="py-4 rounded-xl bg-teal-600 dark:bg-teal-500 text-white font-bold text-sm hover:bg-teal-700 dark:hover:bg-teal-600 transition flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 dark:shadow-teal-500/10"
                    >
                        <PenLine size={18} />
                        日記を書く
                    </button>
                    <button
                        onClick={() => router.push("/diary/history")}
                        className="py-4 rounded-xl bg-white dark:bg-slate-800 text-teal-700 dark:text-teal-300 font-bold text-sm hover:bg-teal-50 dark:hover:bg-slate-700 transition flex items-center justify-center gap-2 border border-teal-200 dark:border-teal-800"
                    >
                        <Calendar size={18} />
                        カレンダー
                    </button>
                </div>

                {/* --- 並べ替え可能なセクション --- */}
                {sectionOrder.map((key, idx) => (
                    <div key={key} className="relative">
                        {/* 編集モード: 上下ボタン */}
                        {isEditMode && (
                            <div className="absolute -top-2 right-2 z-10 flex items-center gap-1 bg-white dark:bg-slate-700 rounded-full shadow-md px-1 py-0.5 border border-stone-200 dark:border-slate-600">
                                <button
                                    onClick={() => moveSection(idx, -1)}
                                    disabled={idx === 0}
                                    className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-slate-600 transition disabled:opacity-30"
                                >
                                    <ChevronUp size={14} className="text-slate-500 dark:text-slate-400" />
                                </button>
                                <button
                                    onClick={() => moveSection(idx, 1)}
                                    disabled={idx === sectionOrder.length - 1}
                                    className="p-1 rounded-full hover:bg-stone-100 dark:hover:bg-slate-600 transition disabled:opacity-30"
                                >
                                    <ChevronDown size={14} className="text-slate-500 dark:text-slate-400" />
                                </button>
                            </div>
                        )}
                        {renderSection(key)}
                    </div>
                ))}

                <div className="pb-4" />
            </div>
        </div>
    );
}
