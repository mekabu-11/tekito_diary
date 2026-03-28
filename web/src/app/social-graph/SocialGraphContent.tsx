/**
 * 人間関係グラフ コンテンツ（SocialGraphContent）
 *
 * core_profiles.people + 日記テキストから人物の関係性を分析し、
 * Canvas 2D API でインタラクティブなネットワーク図を描画する。
 *
 * === 仕組み ===
 * 1. API (/api/ai/social-graph) でAIが人物データを抽出
 * 2. 中心ノード（自分）から放射状に関係者ノードを配置
 * 3. 関係性の種類で色分け、頻度でノードサイズを変動
 * 4. ノードタップで詳細パネル（カード）を表示
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { ArrowLeft, Loader2, Users, RefreshCw } from "lucide-react";

// === 型定義 ===

interface SocialNode {
    name: string;
    relation: string;
    lastSeen: string;
    frequency: number;
    moodImpact: "positive" | "neutral" | "negative";
    episodes: string[];
    suggestion?: string;
}

interface CanvasNode {
    x: number;
    y: number;
    radius: number;
    data: SocialNode;
    color: string;
    targetX: number;
    targetY: number;
}

// === 色の定義 ===

const RELATION_COLORS: Record<string, string> = {
    家族: "#f472b6",   // pink
    友人: "#60a5fa",   // blue
    同僚: "#34d399",   // emerald
    恋人: "#fb923c",   // orange
    知人: "#a78bfa",   // violet
};

const MOOD_EMOJI: Record<string, string> = {
    positive: "☀",
    neutral: "☁",
    negative: "☂",
};

const RELATION_COLORS_DARK: Record<string, string> = {
    家族: "#f9a8d4",
    友人: "#93c5fd",
    同僚: "#6ee7b7",
    恋人: "#fdba74",
    知人: "#c4b5fd",
};

export default function SocialGraphContent() {
    const router = useRouter();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [people, setPeople] = useState<SocialNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedPerson, setSelectedPerson] = useState<SocialNode | null>(null);
    const [canvasNodes, setCanvasNodes] = useState<CanvasNode[]>([]);
    const [isDark, setIsDark] = useState(false);

    // ダークモード検知
    useEffect(() => {
        setIsDark(document.documentElement.classList.contains("dark"));
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains("dark"));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    // データ取得
    const loadData = useCallback(async () => {
        setIsLoading(true);
        setSelectedPerson(null);
        try {
            const res = await fetch("/api/ai/social-graph", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const data = await res.json();
            if (data.people) {
                setPeople(data.people);
            }
        } catch { /* ignore */ }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // ノード配置を計算
    useEffect(() => {
        if (!containerRef.current || people.length === 0) return;

        const width = containerRef.current.clientWidth;
        const height = Math.min(400, width);
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(centerX, centerY) - 50;

        const nodes: CanvasNode[] = people.map((person, i) => {
            const angle = (2 * Math.PI * i) / people.length - Math.PI / 2;
            // 頻度に応じて距離を調整（高頻度→近い）
            const maxFreq = Math.max(...people.map(p => p.frequency), 1);
            const distRatio = 1 - (person.frequency / maxFreq) * 0.4;
            const dist = maxRadius * distRatio;
            const targetX = centerX + dist * Math.cos(angle);
            const targetY = centerY + dist * Math.sin(angle);
            // 頻度に応じたノードサイズ
            const radius = 18 + (person.frequency / maxFreq) * 14;
            const colors = isDark ? RELATION_COLORS_DARK : RELATION_COLORS;
            const color = colors[person.relation] || (isDark ? "#94a3b8" : "#64748b");

            return { x: centerX, y: centerY, radius, data: person, color, targetX, targetY };
        });

        setCanvasNodes(nodes);
    }, [people, isDark]);

    // Canvas 描画 + アニメーション
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || canvasNodes.length === 0) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const dpr = window.devicePixelRatio || 1;

        // 高解像度対応
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.scale(dpr, dpr);

        let animFrame: number;
        const animNodes = canvasNodes.map(n => ({ ...n }));
        let progress = 0;

        const draw = () => {
            progress = Math.min(progress + 0.03, 1);
            const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic

            ctx.clearRect(0, 0, width, height);

            // 接続線を描画
            animNodes.forEach(node => {
                node.x = centerX + (node.targetX - centerX) * ease;
                node.y = centerY + (node.targetY - centerY) * ease;

                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.lineTo(node.x, node.y);
                ctx.strokeStyle = isDark ? "rgba(148,163,184,0.15)" : "rgba(148,163,184,0.25)";
                ctx.lineWidth = 1.5;
                ctx.stroke();
            });

            // 中心ノード（自分）
            ctx.beginPath();
            ctx.arc(centerX, centerY, 22, 0, Math.PI * 2);
            ctx.fillStyle = isDark ? "#0d9488" : "#14b8a6";
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 11px 'Zen Kaku Gothic New', sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("自分", centerX, centerY);

            // 人物ノードを描画
            animNodes.forEach(node => {
                const alpha = ease;

                // ノード円
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
                ctx.fillStyle = node.color;
                ctx.fill();

                // 名前テキスト
                ctx.fillStyle = "#ffffff";
                ctx.font = `bold ${Math.max(9, node.radius * 0.55)}px 'Zen Kaku Gothic New', sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                const displayName = node.data.name.length > 4
                    ? node.data.name.slice(0, 3) + "…"
                    : node.data.name;
                ctx.fillText(displayName, node.x, node.y);

                // 関係性ラベル
                ctx.font = "9px 'Zen Kaku Gothic New', sans-serif";
                ctx.fillStyle = isDark ? "#94a3b8" : "#64748b";
                ctx.fillText(node.data.relation, node.x, node.y + node.radius + 12);

                ctx.globalAlpha = 1;
            });

            if (progress < 1) {
                animFrame = requestAnimationFrame(draw);
            }
        };

        draw();
        return () => cancelAnimationFrame(animFrame);
    }, [canvasNodes, isDark]);

    // ノードのクリック検知
    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        for (const node of canvasNodes) {
            const dx = x - node.targetX;
            const dy = y - node.targetY;
            if (Math.sqrt(dx * dx + dy * dy) <= node.radius + 5) {
                setSelectedPerson(node.data);
                return;
            }
        }
        setSelectedPerson(null);
    };

    // Canvas サイズ設定
    const canvasWidth = containerRef.current?.clientWidth || 360;
    const canvasHeight = Math.min(400, canvasWidth);

    return (
        <div className="min-h-screen bg-stone-50 dark:bg-slate-900 flex flex-col transition-colors duration-300">
            {/* ヘッダー */}
            <header className="bg-white dark:bg-slate-800 border-b border-stone-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3">
                <button
                    onClick={() => router.push("/dashboard")}
                    className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-700 transition"
                >
                    <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                        <Users size={20} className="text-pink-500" />
                        人間関係グラフ
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        日記から読み取った人間関係を可視化
                    </p>
                </div>
                <button
                    onClick={loadData}
                    disabled={isLoading}
                    className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-700 transition disabled:opacity-50"
                    title="再分析"
                >
                    <RefreshCw size={18} className={`text-slate-400 ${isLoading ? "animate-spin" : ""}`} />
                </button>
            </header>

            {/* メインコンテンツ */}
            <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4" ref={containerRef}>
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 size={32} className="animate-spin text-teal-500" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            日記を分析中...
                        </p>
                    </div>
                ) : people.length === 0 ? (
                    <div className="text-center py-20">
                        <Users size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                        <p className="text-slate-500 dark:text-slate-400 text-sm">
                            日記にはまだ人物の登場がありません。
                        </p>
                        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
                            日記を書き続けると、ここに人間関係の図が表示されます。
                        </p>
                    </div>
                ) : (
                    <>
                        {/* ネットワーク図 */}
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-stone-100 dark:border-slate-700 p-3 overflow-hidden">
                            <canvas
                                ref={canvasRef}
                                width={canvasWidth - 24}
                                height={canvasHeight}
                                className="w-full cursor-pointer"
                                onClick={handleCanvasClick}
                            />

                            {/* 凡例 */}
                            <div className="flex flex-wrap gap-3 mt-3 justify-center">
                                {Object.entries(isDark ? RELATION_COLORS_DARK : RELATION_COLORS).map(([label, color]) => (
                                    <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                        {label}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 選択された人物のカード */}
                        {selectedPerson && (
                            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-stone-100 dark:border-slate-700 p-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-base font-extrabold text-slate-800 dark:text-white">
                                        {selectedPerson.name}
                                    </h2>
                                    <span
                                        className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                                        style={{ backgroundColor: (isDark ? RELATION_COLORS_DARK : RELATION_COLORS)[selectedPerson.relation] || "#64748b" }}
                                    >
                                        {selectedPerson.relation}
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    <div className="text-center p-2 bg-stone-50 dark:bg-slate-700 rounded-lg">
                                        <p className="text-lg font-bold text-slate-800 dark:text-white">{selectedPerson.frequency}</p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">登場回数</p>
                                    </div>
                                    <div className="text-center p-2 bg-stone-50 dark:bg-slate-700 rounded-lg">
                                        <p className="text-lg">{MOOD_EMOJI[selectedPerson.moodImpact]}</p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">気分傾向</p>
                                    </div>
                                    <div className="text-center p-2 bg-stone-50 dark:bg-slate-700 rounded-lg">
                                        <p className="text-xs font-bold text-slate-800 dark:text-white mt-1">{selectedPerson.lastSeen}</p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">最終登場</p>
                                    </div>
                                </div>

                                {/* エピソード */}
                                {selectedPerson.episodes?.length > 0 && (
                                    <div className="mb-3">
                                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">エピソード</h3>
                                        <ul className="space-y-1">
                                            {selectedPerson.episodes.map((ep, i) => (
                                                <li key={i} className="text-sm text-slate-700 dark:text-slate-300 leading-snug pl-3 border-l-2 border-pink-300 dark:border-pink-600">
                                                    {ep}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* AI提案 */}
                                {selectedPerson.suggestion && (
                                    <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3 mt-2">
                                        <p className="text-sm text-teal-800 dark:text-teal-200 leading-relaxed">
                                            {selectedPerson.suggestion}
                                        </p>
                                    </div>
                                )}

                                <button
                                    onClick={() => setSelectedPerson(null)}
                                    className="w-full mt-3 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition"
                                >
                                    閉じる
                                </button>
                            </div>
                        )}

                        {/* 人物リスト */}
                        <div className="space-y-2">
                            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 px-1">
                                登場人物一覧（{people.length}人）
                            </h3>
                            {people
                                .sort((a, b) => b.frequency - a.frequency)
                                .map((person, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedPerson(person)}
                                        className={`w-full text-left p-3 rounded-xl border transition hover:shadow-sm ${
                                            selectedPerson?.name === person.name
                                                ? "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800"
                                                : "bg-white dark:bg-slate-800 border-stone-100 dark:border-slate-700 hover:bg-stone-50 dark:hover:bg-slate-750"
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                                style={{ backgroundColor: (isDark ? RELATION_COLORS_DARK : RELATION_COLORS)[person.relation] || "#64748b" }}
                                            >
                                                {person.name[0]}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{person.name}</p>
                                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                                    {person.relation} · {person.frequency}回 · {MOOD_EMOJI[person.moodImpact]} · 最終: {person.lastSeen}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
