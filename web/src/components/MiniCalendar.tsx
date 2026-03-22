/**
 * ミニカレンダーコンポーネント（MiniCalendar）
 *
 * ダッシュボードに表示する今月の小型カレンダー。
 * 日記が書かれた日にはドットを表示し、連続記録日数（ストリーク）も表示する。
 * react-calendar は使わず、軽量な自作グリッドで実装。
 */
"use client";

import { Calendar, Flame } from "lucide-react";

interface MiniCalendarProps {
    diaryDates: Set<string>;
    /** 日付クリック時のコールバック（dateKeyを渡す） */
    onDateClick?: (dateKey: string) => void;
}

const toDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function calcStreak(diaryDates: Set<string>): number {
    const today = new Date();
    let streak = 0;
    let d = new Date(today);
    if (!diaryDates.has(toDateKey(d))) {
        d.setDate(d.getDate() - 1);
    }
    while (diaryDates.has(toDateKey(d))) {
        streak++;
        d.setDate(d.getDate() - 1);
    }
    return streak;
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export default function MiniCalendar({ diaryDates, onDateClick }: MiniCalendarProps) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const todayKey = toDateKey(today);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const streak = calcStreak(diaryDates);

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-stone-100 dark:border-slate-700">
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Calendar size={15} className="text-teal-500" />
                    {year}年{month + 1}月
                </h3>
                {streak > 0 && (
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-full flex items-center gap-1">
                        <Flame size={12} />
                        連続 {streak}日
                    </span>
                )}
            </div>

            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map((w) => (
                    <div key={w} className="text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                        {w}
                    </div>
                ))}
            </div>

            {/* 日付グリッド */}
            <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                    if (day === null) {
                        return <div key={`empty-${i}`} className="h-8" />;
                    }
                    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const hasDiary = diaryDates.has(dateKey);
                    const isToday = dateKey === todayKey;

                    return (
                        <div
                            key={dateKey}
                            onClick={() => hasDiary && onDateClick?.(dateKey)}
                            className={`h-8 flex flex-col items-center justify-center rounded-lg text-xs relative
                                ${hasDiary && onDateClick ? "cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/30 active:scale-95 transition" : ""}
                                ${isToday ? "bg-teal-100 dark:bg-teal-900/40 font-bold text-teal-700 dark:text-teal-300" : "text-slate-600 dark:text-slate-400"}
                            `}
                        >
                            {day}
                            {hasDiary && (
                                <div className="w-1 h-1 rounded-full bg-teal-500 absolute bottom-0.5" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
