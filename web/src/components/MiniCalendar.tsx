/**
 * ミニカレンダーコンポーネント（MiniCalendar）
 *
 * ダッシュボードに表示する今月の小型カレンダー。
 * 日記が書かれた日にはエメラルドグリーンのドットを表示し、
 * 連続記録日数（ストリーク）も算出して表示する。
 *
 * react-calendar は使わず、軽量な自作グリッドで実装。
 */
"use client";

interface MiniCalendarProps {
    /** 日記が存在する日付のセット（"YYYY-MM-DD" 形式） */
    diaryDates: Set<string>;
}

/** Date を "YYYY-MM-DD" 形式に変換 */
const toDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * 今日から遡って連続で日記がある日数を計算する
 * 今日の分がなくても、昨日から連続していればカウントする
 */
function calcStreak(diaryDates: Set<string>): number {
    const today = new Date();
    let streak = 0;
    // 今日に日記があるかチェック
    let d = new Date(today);
    if (!diaryDates.has(toDateKey(d))) {
        // 今日はまだ → 昨日から数える
        d.setDate(d.getDate() - 1);
    }
    while (diaryDates.has(toDateKey(d))) {
        streak++;
        d.setDate(d.getDate() - 1);
    }
    return streak;
}

/** 曜日ラベル */
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export default function MiniCalendar({ diaryDates }: MiniCalendarProps) {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const todayKey = toDateKey(today);

    // 今月の日数と1日の曜日
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay();

    // カレンダーグリッド用の配列を生成（空セル + 日付セル）
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const streak = calcStreak(diaryDates);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
            {/* ヘッダー: 年月表示 */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">
                    📅 {year}年{month + 1}月
                </h3>
                {streak > 0 && (
                    <span className="text-xs font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded-lg">
                        🔥 連続 {streak}日
                    </span>
                )}
            </div>

            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map((w) => (
                    <div key={w} className="text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500">
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
                            className={`h-8 flex flex-col items-center justify-center rounded-lg text-xs relative
                                ${isToday ? "bg-emerald-100 dark:bg-emerald-900/40 font-bold text-emerald-700 dark:text-emerald-300" : "text-gray-600 dark:text-gray-400"}
                            `}
                        >
                            {day}
                            {hasDiary && (
                                <div className="w-1 h-1 rounded-full bg-emerald-500 absolute bottom-0.5" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
