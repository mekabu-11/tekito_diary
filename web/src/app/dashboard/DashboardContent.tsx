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
    CheckCircle2,
    Circle,
    GripHorizontal,
    Loader2,
    LogOut,
    MessageCircle,
    Moon,
    PenLine,
    Plus,
    Settings2,
    Shield,
    Shuffle,
    Sparkles,
    Sun,
    TrendingUp,
    Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ========== 型定義 ==========

interface Diary {
    id: string;
    date: string;
    display_date: string;
    original_text: string;
    formatted_text: string;
}

interface Todo {
    id: string;
    content: string;
    diary_date: string;
    is_completed: boolean;
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

// ========== Toggle & Edit Components ==========

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!enabled)}
            className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 shrink-0 ${
                enabled ? "bg-teal-500" : "bg-stone-300 dark:bg-slate-600"
            }`}
        >
            <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    enabled ? "translate-x-5" : "translate-x-0"
                }`}
            />
        </button>
    );
}

function SortableWidgetRow({ id, enabled, onToggle, title, icon }: { id: string; enabled: boolean; onToggle: (v: boolean) => void; title: string; icon: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 1 };
    return (
        <div ref={setNodeRef} style={style} className={`flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-stone-200 dark:border-slate-700 ${isDragging ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-3">
                <div {...attributes} {...listeners} className="p-2 cursor-grab active:cursor-grabbing text-slate-400 dark:text-slate-500 hover:bg-stone-100 dark:hover:bg-slate-700 rounded-lg touch-none" style={{ touchAction: 'none' }}>
                    <GripHorizontal size={18} />
                </div>
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold text-sm">
                    {icon}
                    {title}
                </div>
            </div>
            <Toggle enabled={enabled} onChange={onToggle} />
        </div>
    );
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

    // --- TODO ---
    const [todos, setTodos] = useState<Todo[]>([]);
    const [isTodosLoading, setIsTodosLoading] = useState(false);
    const [newTodoText, setNewTodoText] = useState("");

    // --- 並べ替え状態 ---
    const [isEditMode, setIsEditMode] = useState(false);
    const [widgets, setWidgets] = useState<{ id: string; enabled: boolean }[]>([
        { id: "mood", enabled: true },
        { id: "comment", enabled: true },
        { id: "report", enabled: false },
        { id: "random", enabled: true },
        { id: "todos", enabled: true },
    ]);

    // --- カルーセル状態 ---
    const carouselRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(0);

    const todayKey = toDateKey(new Date());
    const greeting = getGreeting();

    // ========================================
    // 初期化
    // ========================================

    useEffect(() => {
        const savedWidgets = localStorage.getItem("dashboard_widgets");
        if (savedWidgets) {
            try {
                setWidgets(JSON.parse(savedWidgets));
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
            loadTodos();
        } finally {
            setIsLoading(false);
        }
    };

    // ========================================
    // AI データ取得
    // ========================================

    const loadTodos = async () => {
        setIsTodosLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
                .from("todos")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: true });
            if (data) setTodos(data);
        } finally {
            setIsTodosLoading(false);
        }
    };

    const toggleTodo = async (todo: Todo) => {
        const updated = { ...todo, is_completed: !todo.is_completed };
        setTodos((prev) => prev.map((t) => t.id === todo.id ? updated : t));
        await supabase.from("todos").update({ is_completed: updated.is_completed }).eq("id", todo.id);
    };

    const deleteTodo = async (id: string) => {
        setTodos((prev) => prev.filter((t) => t.id !== id));
        await supabase.from("todos").delete().eq("id", id);
    };

    const addTodo = async () => {
        const text = newTodoText.trim();
        if (!text) return;
        setNewTodoText("");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
            .from("todos")
            .insert({
                user_id: user.id,
                content: text,
                diary_date: todayKey,
                is_completed: false,
            })
            .select()
            .single();
        if (data) setTodos((prev) => [...prev, data]);
    };

    const loadAIData = async (allDiaries: Diary[]) => {
        const recent7 = allDiaries.slice(0, 7).reverse();
        if (recent7.length >= 1) {
            loadMoodData(recent7);
        }

        // コメント: 3日前前後の日記をもとにアドバイス
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const targetKey = toDateKey(threeDaysAgo);
        // 3日前を中心に前後1日の日記を取得（2〜4日前）
        const commentDiaries = allDiaries.filter((d) => {
            const diff = Math.abs(
                (new Date(targetKey).getTime() - new Date(d.date).getTime()) / (1000 * 60 * 60 * 24)
            );
            return diff <= 1;
        });
        if (commentDiaries.length > 0) {
            loadComment(commentDiaries, "recent");
        } else if (allDiaries.length > 0) {
            // 3日前付近の日記がなければ直近5件からユーザーの傾向を分析
            loadComment(allDiaries.slice(0, 5), "tendency");
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

    const loadComment = async (recentDiaries: Diary[], mode: "recent" | "tendency" = "recent") => {
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
                    mode,
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
    // カスタマイズ・カルーセルハンドラ
    // ========================================

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = widgets.findIndex(w => w.id === active.id);
            const newIndex = widgets.findIndex(w => w.id === over.id);
            
            const newArray = arrayMove(widgets, oldIndex, newIndex);
            setWidgets(newArray);
            localStorage.setItem("dashboard_widgets", JSON.stringify(newArray));
        }
    };

    const toggleWidget = (id: string, enabled: boolean) => {
        const newArray = widgets.map(w => w.id === id ? { ...w, enabled } : w);
        setWidgets(newArray);
        localStorage.setItem("dashboard_widgets", JSON.stringify(newArray));
    };

    const handleScroll = () => {
        if (!carouselRef.current) return;
        const scrollLeft = carouselRef.current.scrollLeft;
        const width = carouselRef.current.clientWidth;
        if (width === 0) return;
        const index = Math.round(scrollLeft / width);
        setActiveIndex(index);
    };

    const getWidgetInfo = (id: string) => {
        switch (id) {
            case "mood": return { title: "気分トレンド", icon: <TrendingUp size={16} className="text-teal-500" /> };
            case "comment": return { title: "AIからのアドバイス", icon: <MessageCircle size={16} className="text-teal-500" /> };
            case "report": return { title: "先週の振り返り", icon: <BookOpen size={16} className="text-teal-500" /> };
            case "random": return { title: "過去の日記ピックアップ", icon: <Bookmark size={16} className="text-amber-500" /> };
            case "todos": return { title: "TODO", icon: <CheckCircle2 size={16} className="text-violet-500" /> };
            default: return { title: id, icon: <Settings2 size={16} /> };
        }
    };

    const renderSection = (key: string) => {
        switch (key) {
            case "mood":
                return <MoodChart data={moodData} isLoading={isMoodLoading} />;
            case "comment":
                if (!isCommentLoading && !aiComment) return null;
                return (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-stone-100 dark:border-slate-700 h-full flex flex-col">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5 shrink-0">
                            <MessageCircle size={15} className="text-teal-500" />
                            AIからのアドバイス
                        </h3>
                        {isCommentLoading ? (
                            <div className="flex items-center gap-2 flex-1">
                                <Loader2 size={14} className="animate-spin text-slate-400" />
                                <span className="text-xs text-slate-400">考え中...</span>
                            </div>
                        ) : (
                            <div className="bg-teal-50 dark:bg-teal-900/15 rounded-lg p-3 flex-1 overflow-y-auto">
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
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-stone-100 dark:border-slate-700 h-full flex flex-col">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5 shrink-0">
                            <BookOpen size={15} className="text-teal-500" />
                            先週の振り返り
                        </h3>
                        {isReportLoading ? (
                            <div className="flex items-center gap-2 flex-1">
                                <Loader2 size={14} className="animate-spin text-slate-400" />
                                <span className="text-xs text-slate-400">レポートを生成中...</span>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap flex-1 overflow-y-auto">
                                {weeklyReport}
                            </p>
                        )}
                    </div>
                );
            case "random":
                if (!randomDiary) return null;
                return (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-stone-100 dark:border-slate-700 h-full flex flex-col">
                        <div className="flex items-center justify-between mb-2 shrink-0">
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
                            className="bg-amber-50 dark:bg-amber-900/15 rounded-lg p-3 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/25 transition flex-1 flex flex-col"
                        >
                            <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mb-1 shrink-0">
                                {randomDiary.display_date}
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3 flex-1 mt-1">
                                {randomDiary.formatted_text.slice(0, 100)}
                                {randomDiary.formatted_text.length > 100 ? "..." : ""}
                            </p>
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 font-semibold shrink-0">
                                続きを見る →
                            </p>
                        </div>
                    </div>
                );
            case "todos": {
                const incomplete = todos.filter((t) => !t.is_completed);
                const completed = todos.filter((t) => t.is_completed);
                return (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-stone-100 dark:border-slate-700 h-full flex flex-col">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5 shrink-0">
                            <CheckCircle2 size={15} className="text-violet-500" />
                            TODO
                            {todos.length > 0 && (
                                <span className="text-xs font-normal text-slate-400 dark:text-slate-500 ml-1">
                                    {incomplete.length}件
                                </span>
                            )}
                        </h3>
                        {/* 手動追加入力 */}
                        <form
                            onSubmit={(e) => { e.preventDefault(); addTodo(); }}
                            className="flex gap-2 mb-3 shrink-0"
                        >
                            <input
                                type="text"
                                value={newTodoText}
                                onChange={(e) => setNewTodoText(e.target.value)}
                                placeholder="新しいTODOを追加..."
                                className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-stone-200 dark:border-slate-600 bg-stone-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:focus:ring-violet-500 focus:border-transparent"
                            />
                            <button
                                type="submit"
                                disabled={!newTodoText.trim()}
                                className="shrink-0 p-1.5 rounded-lg bg-violet-500 text-white hover:bg-violet-600 transition disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <Plus size={16} />
                            </button>
                        </form>
                        {isTodosLoading ? (
                            <div className="flex items-center gap-2 flex-1">
                                <Loader2 size={14} className="animate-spin text-slate-400" />
                                <span className="text-xs text-slate-400">読み込み中...</span>
                            </div>
                        ) : todos.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center">
                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                    TODOはまだありません。上から追加するか、日記を書くとAIが自動抽出します。
                                </p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto space-y-1">
                                {incomplete.map((todo) => (
                                    <div key={todo.id} className="flex items-start gap-2 group">
                                        <button onClick={() => toggleTodo(todo)} className="mt-0.5 shrink-0 text-stone-300 dark:text-slate-600 hover:text-violet-500 dark:hover:text-violet-400 transition">
                                            <Circle size={16} />
                                        </button>
                                        <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 leading-snug">{todo.content}</span>
                                        <button onClick={() => deleteTodo(todo.id)} className="shrink-0 text-stone-200 dark:text-slate-700 hover:text-red-400 dark:hover:text-red-400 transition opacity-0 group-hover:opacity-100 text-xs px-1">
                                            ×
                                        </button>
                                    </div>
                                ))}
                                {completed.length > 0 && (
                                    <>
                                        {incomplete.length > 0 && <div className="border-t border-stone-100 dark:border-slate-700 my-2" />}
                                        {completed.map((todo) => (
                                            <div key={todo.id} className="flex items-start gap-2 group opacity-50">
                                                <button onClick={() => toggleTodo(todo)} className="mt-0.5 shrink-0 text-violet-400 dark:text-violet-500 hover:text-stone-300 dark:hover:text-slate-600 transition">
                                                    <CheckCircle2 size={16} />
                                                </button>
                                                <span className="flex-1 text-sm text-slate-400 dark:text-slate-500 leading-snug line-through">{todo.content}</span>
                                                <button onClick={() => deleteTodo(todo.id)} className="shrink-0 text-stone-200 dark:text-slate-700 hover:text-red-400 dark:hover:text-red-400 transition opacity-0 group-hover:opacity-100 text-xs px-1">
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                );
            }
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

                {/* --- 新機能リンク --- */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => router.push("/social-graph")}
                        className="py-3 rounded-xl bg-white dark:bg-slate-800 text-pink-600 dark:text-pink-300 font-bold text-sm hover:bg-pink-50 dark:hover:bg-slate-700 transition flex items-center justify-center gap-2 border border-pink-200 dark:border-pink-800"
                    >
                        <Users size={18} />
                        人間関係
                    </button>
                    <button
                        onClick={() => router.push("/twin-chat")}
                        className="py-3 rounded-xl bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-300 font-bold text-sm hover:bg-violet-50 dark:hover:bg-slate-700 transition flex items-center justify-center gap-2 border border-violet-200 dark:border-violet-800"
                    >
                        <Sparkles size={18} />
                        AI対話
                    </button>
                </div>

                {/* --- カレンダー（固定） --- */}
                {!isEditMode && (
                    <div className="mb-2">
                        <MiniCalendar diaryDates={diaryDates} onDateClick={(dateKey) => router.push(`/diary/history?date=${dateKey}`)} />
                    </div>
                )}

                {/* --- ウィジェットエリア --- */}
                {isEditMode ? (
                    <div className="space-y-3 pt-6 border-t border-stone-200 dark:border-slate-700">
                        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1.5 mb-4">
                            <Settings2 size={16} />
                            ダッシュボードのカスタマイズ
                        </h3>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={widgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
                                {widgets.map(w => {
                                    const info = getWidgetInfo(w.id);
                                    return (
                                        <SortableWidgetRow 
                                            key={w.id} 
                                            id={w.id} 
                                            enabled={w.enabled} 
                                            onToggle={(v) => toggleWidget(w.id, v)} 
                                            title={info.title} 
                                            icon={info.icon} 
                                        />
                                    );
                                })}
                            </SortableContext>
                        </DndContext>
                    </div>
                ) : (
                    widgets.filter(w => w.enabled).length > 0 && (
                        <div className="relative pt-2 -mx-4 px-4 overflow-hidden">
                            <div 
                                className="flex w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 pb-2 items-stretch"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                ref={carouselRef}
                                onScroll={handleScroll}
                            >
                                {widgets.filter(w => w.enabled).map(w => (
                                    <div key={w.id} className="snap-center shrink-0 w-[92%] max-w-[340px] flex [&>div]:w-full [&>div]:flex-1">
                                        {renderSection(w.id)}
                                    </div>
                                ))}
                            </div>
                            {widgets.filter(w => w.enabled).length > 1 && (
                                <div className="flex justify-center gap-1.5 mt-2 transition-all">
                                    {widgets.filter(w => w.enabled).map((_, i) => (
                                        <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === activeIndex ? "w-4 bg-teal-500" : "w-1.5 bg-stone-300 dark:bg-slate-600"}`} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                )}

                <div className="pb-4" />
            </div>
        </div>
    );
}
