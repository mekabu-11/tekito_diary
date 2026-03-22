/**
 * 気分トレンドグラフ（MoodChart）
 *
 * 直近7日間の気分スコア（1〜5）をSVGの折れ線グラフで表示する。
 * 外部チャートライブラリを使わず、CSS + SVG で軽量に実装。
 *
 * スコアの意味: 1=低い  2=やや低い  3=普通  4=良い  5=とても良い
 */
"use client";

import { TrendingUp } from "lucide-react";

interface MoodChartProps {
    data: { date: string; score: number }[];
    isLoading?: boolean;
}

/** スコアに対応する短いラベル */
const MOOD_LABEL: Record<number, string> = {
    1: "1",
    2: "2",
    3: "3",
    4: "4",
    5: "5",
};

export default function MoodChart({ data, isLoading }: MoodChartProps) {
    if (isLoading) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-stone-100 dark:border-slate-700 h-full flex flex-col">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5 shrink-0">
                    <TrendingUp size={15} className="text-teal-500" />
                    気分トレンド
                </h3>
                <div className="flex items-center justify-center h-28 flex-1">
                    <div className="animate-pulse flex gap-2">
                        {[...Array(7)].map((_, i) => (
                            <div key={i} className="w-6 h-12 bg-stone-200 dark:bg-slate-700 rounded" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-stone-100 dark:border-slate-700 h-full flex flex-col">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5 shrink-0">
                    <TrendingUp size={15} className="text-teal-500" />
                    気分トレンド
                </h3>
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
                        日記を書くと気分の変化がグラフで表示されます
                    </p>
                </div>
            </div>
        );
    }

    const width = 280;
    const height = 100;
    const padX = 20;
    const padY = 15;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;

    const points = data.map((d, i) => ({
        x: padX + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2),
        y: padY + chartH - ((d.score - 1) / 4) * chartH,
        score: d.score,
        date: d.date,
    }));

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padY} L ${points[0].x} ${height - padY} Z`;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-stone-100 dark:border-slate-700 h-full flex flex-col">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5 shrink-0">
                <TrendingUp size={15} className="text-teal-500" />
                気分トレンド
            </h3>

            <div className="flex justify-center flex-1 items-center">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[300px]">
                    <defs>
                        <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#0D9488" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#0D9488" stopOpacity="0.0" />
                        </linearGradient>
                    </defs>

                    {/* グリッドライン */}
                    {[1, 2, 3, 4, 5].map((v) => {
                        const y = padY + chartH - ((v - 1) / 4) * chartH;
                        return (
                            <line
                                key={v}
                                x1={padX}
                                y1={y}
                                x2={width - padX}
                                y2={y}
                                stroke="currentColor"
                                strokeOpacity={0.08}
                                className="text-slate-400 dark:text-slate-600"
                            />
                        );
                    })}

                    {/* エリア塗りつぶし */}
                    <path d={areaPath} fill="url(#moodGradient)" />

                    {/* 折れ線 */}
                    <path d={linePath} fill="none" stroke="#0D9488" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                    {/* ポイント（丸＋スコアラベル） */}
                    {points.map((p, i) => (
                        <g key={i}>
                            <circle cx={p.x} cy={p.y} r="4" fill="#0D9488" stroke="white" strokeWidth="2" />
                            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="9" fontWeight="700" fill="#0D9488">
                                {MOOD_LABEL[p.score] || p.score}
                            </text>
                        </g>
                    ))}

                    {/* 日付ラベル */}
                    {points.map((p, i) => (
                        <text
                            key={`label-${i}`}
                            x={p.x}
                            y={height - 2}
                            textAnchor="middle"
                            fontSize="8"
                            fill="currentColor"
                            fillOpacity={0.4}
                            className="text-slate-500 dark:text-slate-400"
                        >
                            {p.date.slice(5).replace("-", "/")}
                        </text>
                    ))}
                </svg>
            </div>
        </div>
    );
}
