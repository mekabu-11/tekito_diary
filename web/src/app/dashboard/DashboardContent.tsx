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
    Calendar,
    Loader2,
    LogOut,
    Moon,
    PenLine,
    RefreshCw,
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
function getGreeting(): { message: string; emoji: string } {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return { message: "おはようございます", emoji: "☀️" };
    if (hour >= 11 && hour < 17) return { message: "こんにちは", emoji: "🌤" };
    if (hour >= 17 && hour < 21) return { message: "お疲れ様です", emoji: "🌅" };
    return { message: "おやすみ前のひととき", emoji: "🌙" };
}

/** 先週の月〜日の日付範囲を取得する */
function getLastWeekRange(): { start: Date; end: Date } {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=日曜, 1=月曜...
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

    const todayKey = toDateKey(new Date());
    const greeting = getGreeting();

    // ========================================
    // 初期化
    // ========================================

    useEffect(() => {
        loadInitialData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** プロフィール + 全日記データを読み込む */
    const loadInitialData = async () => {
        setIsLoading(true);
        try {
            // プロフィール取得
            const profileRes = await fetch("/api/auth/profile");
            if (profileRes.ok) {
                const profile = await profileRes.json();
                setDisplayName(profile.displayName || profile.email || "");
                setIsAdmin(profile.isAdmin === true);
            }

            // 全日記データ取得
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

                // ランダム日記ピックアップ
                pickRandomDiary(data);

                // AI系データをバックグラウンドで取得
                loadAIData(data);
            }
        } finally {
            setIsLoading(false);
        }
    };

    // ========================================
    // AI データ取得
    // ========================================

    /** AI系のデータを並列でバックグラウンド取得 */
    const loadAIData = async (allDiaries: Diary[]) => {
        // 気分トレンド: 直近7日間
        const recent7 = allDiaries.slice(0, 7).reverse();
        if (recent7.length >= 2) {
            loadMoodData(recent7);
        }

        // 今日の一言: 直近3件
        const recent3 = allDiaries.slice(0, 3);
        if (recent3.length > 0) {
            loadComment(recent3);
        }

        // 週間レポート: 先週分
        const { start, end } = getLastWeekRange();
        const startKey = toDateKey(start);
        const endKey = toDateKey(end);
        const lastWeekDiaries = allDiaries.filter((d) => d.date >= startKey && d.date <= endKey);
        if (lastWeekDiaries.length >= 2) {
            loadWeeklyReport(lastWeekDiaries, startKey);
        }
    };

    /** 気分トレンドデータを取得（キャッシュあり） */
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

    /** AI一言コメントを取得（キャッシュあり） */
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

    /** 週間レポートを取得（キャッシュあり） */
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

        // 優先: 1年前 → 半年前 → 3ヶ月前 → ランダム
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

        // 今日の日記を除いてランダムに1件選ぶ
        const pastDiaries = allDiaries.filter((d) => d.date !== todayKey);
        if (pastDiaries.length > 0) {
            const idx = Math.floor(Math.random() * pastDiaries.length);
            setRandomDiary(pastDiaries[idx]);
        }
    };

    /** ランダム日記をシャッフル */
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
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <Loader2 size={32} className="animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-300">
            {/* ===== ヘッダー ===== */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
                <div>
                    <p className="text-lg font-extrabold text-gray-900 dark:text-white">
                        {greeting.emoji} {greeting.message}
                    </p>
                    {displayName && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {displayName}さん
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    {/* テーマ切替ボタン */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                        title={theme === "dark" ? "ライトモード" : "ダークモード"}
                    >
                        {theme === "dark" ? (
                            <Sun size={18} className="text-amber-400" />
                        ) : (
                            <Moon size={18} className="text-gray-500" />
                        )}
                    </button>
                    {/* 管理者リンク */}
                    {isAdmin && (
                        <button
                            onClick={() => router.push("/admin")}
                            className="p-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition"
                            title="管理画面"
                        >
                            <Shield size={18} className="text-amber-500" />
                        </button>
                    )}
                    {/* ログアウト */}
                    <button
                        onClick={handleLogout}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                        <LogOut size={18} className="text-gray-500 dark:text-gray-400" />
                    </button>
                </div>
            </header>

            {/* ===== メインコンテンツ ===== */}
            <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">

                {/* --- 今日の日記ステータス --- */}
                <div
                    onClick={() =>
                        router.push(todayDiary ? `/diary/history?date=${todayKey}` : "/diary")
                    }
                    className={`rounded-2xl shadow-sm p-4 cursor-pointer transition-all active:scale-[0.98] ${
                        todayDiary
                            ? "bg-emerald-500 dark:bg-emerald-600 text-white"
                            : "bg-white dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-600"
                    }`}
                >
                    {todayDiary ? (
                        <>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">✅</span>
                                <p className="text-sm font-bold">今日の日記を書きました！</p>
                            </div>
                            <p className="text-xs opacity-80 line-clamp-2">
                                {todayDiary.formatted_text.slice(0, 80)}...
                            </p>
                        </>
                    ) : (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                                <PenLine size={20} className="text-emerald-500" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-900 dark:text-white">
                                    今日の日記を書こう！
                                </p>
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                    タップして日記を書き始める ✏️
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- ミニカレンダー --- */}
                <MiniCalendar diaryDates={diaryDates} />

                {/* --- 月間統計 --- */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">
                        📊 今月の統計
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-xl p-3 text-center">
                            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                                {thisMonthDiaries.length}
                                <span className="text-sm font-medium text-gray-400 dark:text-gray-500">
                                    /{daysElapsed}日
                                </span>
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">記録日数</p>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-3 text-center">
                            <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
                                {totalChars.toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">総文字数</p>
                        </div>
                    </div>
                </div>

                {/* --- 気分トレンド --- */}
                <MoodChart data={moodData} isLoading={isMoodLoading} />

                {/* --- AIからの一言 --- */}
                {(isCommentLoading || aiComment) && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                            💬 AIからの一言
                        </h3>
                        {isCommentLoading ? (
                            <div className="flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin text-gray-400" />
                                <span className="text-xs text-gray-400">考え中...</span>
                            </div>
                        ) : (
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
                                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                    🤖 {aiComment}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* --- 週間振り返りレポート --- */}
                {(isReportLoading || weeklyReport) && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">
                            📖 先週の振り返り
                        </h3>
                        {isReportLoading ? (
                            <div className="flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin text-gray-400" />
                                <span className="text-xs text-gray-400">レポートを生成中...</span>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                {weeklyReport}
                            </p>
                        )}
                    </div>
                )}

                {/* --- ランダム過去日記 --- */}
                {randomDiary && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                🎲 過去の日記ピックアップ
                            </h3>
                            <button
                                onClick={shuffleRandomDiary}
                                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                                title="シャッフル"
                            >
                                <Shuffle size={14} className="text-gray-400" />
                            </button>
                        </div>
                        <div
                            onClick={() => router.push(`/diary/history?date=${randomDiary.date}`)}
                            className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition"
                        >
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1">
                                {randomDiary.display_date}
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
                                {randomDiary.formatted_text.slice(0, 100)}
                                {randomDiary.formatted_text.length > 100 ? "..." : ""}
                            </p>
                            <p className="text-xs text-amber-500 dark:text-amber-400 mt-2 font-semibold">
                                続きを見る →
                            </p>
                        </div>
                    </div>
                )}

                {/* --- フッターナビ --- */}
                <div className="grid grid-cols-2 gap-3 pt-2 pb-4">
                    <button
                        onClick={() => router.push("/diary")}
                        className="py-4 rounded-2xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/40"
                    >
                        <PenLine size={18} />
                        日記を書く
                    </button>
                    <button
                        onClick={() => router.push("/diary/history")}
                        className="py-4 rounded-2xl bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 font-bold text-sm hover:bg-emerald-50 dark:hover:bg-gray-700 transition flex items-center justify-center gap-2 border border-emerald-200 dark:border-emerald-700"
                    >
                        <Calendar size={18} />
                        カレンダー
                    </button>
                </div>
            </div>
        </div>
    );
}
