/**
 * 気分トレンドグラフ（MoodChart）
 *
 * 直近7日間の気分スコア（1〜5）をSVGの折れ線グラフで表示する。
 * 外部チャートライブラリを使わず、CSS + SVG で軽量に実装。
 *
 * スコアの意味:
 *   1=😢  2=😐  3=🙂  4=😊  5=🤩
 */
"use client";

interface MoodChartProps {
    /** 日付とスコアの配列（古い順） */
    data: { date: string; score: number }[];
    /** ロード中フラグ */
    isLoading?: boolean;
}

/** スコアに対応する絵文字 */
const MOOD_EMOJI: Record<number, string> = {
    1: "😢",
    2: "😐",
    3: "🙂",
    4: "😊",
    5: "🤩",
};

export default function MoodChart({ data, isLoading }: MoodChartProps) {
    if (isLoading) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">😊 気分トレンド</h3>
                <div className="flex items-center justify-center h-28">
                    <div className="animate-pulse flex gap-2">
                        {[...Array(7)].map((_, i) => (
                            <div key={i} className="w-6 h-12 bg-gray-200 dark:bg-gray-700 rounded" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (data.length === 0) {
        return null;
    }

    // SVG サイズ
    const width = 280;
    const height = 100;
    const padX = 20;
    const padY = 15;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;

    // ポイントの座標を計算
    const points = data.map((d, i) => ({
        x: padX + (data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2),
        y: padY + chartH - ((d.score - 1) / 4) * chartH,
        score: d.score,
        date: d.date,
    }));

    // パスを作成
    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

    // グラデーション用のエリアパス
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padY} L ${points[0].x} ${height - padY} Z`;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4">
            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">😊 気分トレンド</h3>

            <div className="flex justify-center">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[300px]">
                    <defs>
                        <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                        </linearGradient>
                    </defs>

                    {/* グリッドライン（横線）*/}
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
                                className="text-gray-400 dark:text-gray-600"
                            />
                        );
                    })}

                    {/* エリア塗りつぶし */}
                    <path d={areaPath} fill="url(#moodGradient)" />

                    {/* 折れ線 */}
                    <path d={linePath} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                    {/* ポイント（丸＋絵文字） */}
                    {points.map((p, i) => (
                        <g key={i}>
                            <circle cx={p.x} cy={p.y} r="4" fill="#10B981" stroke="white" strokeWidth="2" />
                            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10">
                                {MOOD_EMOJI[p.score] || "🙂"}
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
                            className="text-gray-500 dark:text-gray-400"
                        >
                            {p.date.slice(5).replace("-", "/")}
                        </text>
                    ))}
                </svg>
            </div>
        </div>
    );
}
