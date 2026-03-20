"use client";

import { DiaryVersion, getDiaryVersions, saveDiaryVersion } from "@/lib/diary-versions";
import { createClient } from "@/lib/supabase";
import { ArrowLeft, Check, Clock, Edit3, Loader2, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

interface Diary {
    id: string;
    date: string;
    display_date: string;
    original_text: string;
    formatted_text: string;
}

const toDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function HistoryContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialDate = searchParams.get("date");
    const supabase = createClient();

    const [diaries, setDiaries] = useState<Diary[]>([]);
    const [diaryDates, setDiaryDates] = useState<Set<string>>(new Set());
    const [selectedDate, setSelectedDate] = useState<string>(initialDate || toDateKey(new Date()));
    const [selectedDiary, setSelectedDiary] = useState<Diary | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [versions, setVersions] = useState<DiaryVersion[]>([]);
    const [showVersions, setShowVersions] = useState(false);
    const [isRestoringVersion, setIsRestoringVersion] = useState(false);
    const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
    const [isEditingMemo, setIsEditingMemo] = useState(false);
    const [editMemoText, setEditMemoText] = useState("");
    const [isSavingMemo, setIsSavingMemo] = useState(false);
    const [showBrushUpInput, setShowBrushUpInput] = useState(false);
    const [brushUpInstruction, setBrushUpInstruction] = useState("");
    const [isBrushingUp, setIsBrushingUp] = useState(false);
    const [brushUpPreview, setBrushUpPreview] = useState<string | null>(null);

    const loadDiaries = useCallback(async () => {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setIsLoading(false);
            return;
        }

        try {
            const { data } = await supabase
                .from("diaries")
                .select("*")
                .eq("user_id", user.id)
                .order("date", { ascending: false });

            if (data) {
                setDiaries(data);
                setDiaryDates(new Set(data.map((d) => d.date)));

                const targetDate = initialDate || toDateKey(new Date());
                const found = data.find((d) => d.date === targetDate);
                if (found) {
                    setSelectedDate(targetDate);
                    setSelectedDiary(found);
                }
            }
        } finally {
            setIsLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialDate]); // We don't want to re-run this on every supabase instance change

    useEffect(() => {
        loadDiaries();
    }, [loadDiaries]);

    const handleDateClick = (date: Date) => {
        const key = toDateKey(date);
        setSelectedDate(key);
        const found = diaries.find((d) => d.date === key);
        setSelectedDiary(found || null);
        setIsEditing(false);
        setIsEditingMemo(false);
        setShowVersions(false);
        setShowBrushUpInput(false);
        setBrushUpPreview(null);
    };

    const startBrushUp = () => {
        setShowBrushUpInput(true);
        setBrushUpInstruction("");
        setBrushUpPreview(null);
    };

    const executeBrushUp = async () => {
        if (!selectedDiary) return;
        setIsBrushingUp(true);
        try {
            const res = await fetch("/api/ai/brushup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: selectedDiary.formatted_text,
                    instruction: brushUpInstruction.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (data.brushedUp) {
                setBrushUpPreview(data.brushedUp);
            }
        } catch {
            // エラー時は何もしない
        } finally {
            setIsBrushingUp(false);
        }
    };

    const applyBrushUp = async () => {
        if (!selectedDiary || !brushUpPreview) return;
        setIsSaving(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setIsSaving(false);
            return;
        }

        // バージョン保存
        await saveDiaryVersion(
            supabase,
            selectedDiary.id,
            user.id,
            selectedDiary.formatted_text,
            selectedDiary.original_text,
        );

        const { error } = await supabase
            .from("diaries")
            .update({
                formatted_text: brushUpPreview,
                updated_at: new Date().toISOString(),
            })
            .eq("id", selectedDiary.id);

        if (!error) {
            const updated = { ...selectedDiary, formatted_text: brushUpPreview };
            setSelectedDiary(updated);
            setDiaries((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        }
        setBrushUpPreview(null);
        setShowBrushUpInput(false);
        setIsSaving(false);
    };

    const cancelBrushUp = () => {
        setBrushUpPreview(null);
        setShowBrushUpInput(false);
        setBrushUpInstruction("");
    };

    const startEditing = () => {
        if (!selectedDiary) return;
        setEditText(selectedDiary.formatted_text);
        setIsEditing(true);
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setEditText("");
    };

    const saveEdit = async () => {
        if (!selectedDiary) return;
        setIsSaving(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setIsSaving(false);
            return;
        }

        // 保存前にバージョンを記録
        await saveDiaryVersion(
            supabase,
            selectedDiary.id,
            user.id,
            selectedDiary.formatted_text,
            selectedDiary.original_text,
        );

        const { error } = await supabase
            .from("diaries")
            .update({
                formatted_text: editText,
                updated_at: new Date().toISOString(),
            })
            .eq("id", selectedDiary.id);

        if (!error) {
            const updated = { ...selectedDiary, formatted_text: editText };
            setSelectedDiary(updated);
            setDiaries((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
            setIsEditing(false);
        }
        setIsSaving(false);
    };

    const loadVersions = async () => {
        if (!selectedDiary) return;
        const v = await getDiaryVersions(supabase, selectedDiary.id);
        setVersions(v);
        setShowVersions(true);
    };

    const restoreVersion = async (version: DiaryVersion) => {
        if (!selectedDiary) return;
        setIsRestoringVersion(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setIsRestoringVersion(false);
            return;
        }

        // 復元前に現在の状態をバージョンとして保存
        await saveDiaryVersion(
            supabase,
            selectedDiary.id,
            user.id,
            selectedDiary.formatted_text,
            selectedDiary.original_text,
        );

        const { error } = await supabase
            .from("diaries")
            .update({
                formatted_text: version.formatted_text,
                original_text: version.original_text,
                updated_at: new Date().toISOString(),
            })
            .eq("id", selectedDiary.id);

        if (!error) {
            const updated = {
                ...selectedDiary,
                formatted_text: version.formatted_text,
                original_text: version.original_text
            };
            setSelectedDiary(updated);
            setDiaries((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
            setShowVersions(false);
            // バージョン一覧を再読み込み
            const v = await getDiaryVersions(supabase, selectedDiary.id);
            setVersions(v);
        }
        setIsRestoringVersion(false);
    };

    const tileContent = ({ date, view }: { date: Date; view: string }) => {
        if (view !== "month") return null;
        const key = toDateKey(date);
        if (diaryDates.has(key)) {
            return <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mx-auto mt-0.5" />;
        }
        return null;
    };

    const formatVersionDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleString("ja-JP", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
                <button onClick={() => router.push("/diary")} className="p-2 rounded-lg hover:bg-gray-100 transition">
                    <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <h1 className="text-lg font-extrabold text-gray-900">日記カレンダー</h1>
            </header>

            <div className="max-w-lg mx-auto p-4 space-y-4">
                {isLoading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 size={32} className="animate-spin text-emerald-500" />
                    </div>
                ) : (<>
                    <div className="bg-white rounded-2xl shadow-sm p-4 calendar-wrapper">
                        <Calendar
                            onClickDay={handleDateClick}
                            locale="ja-JP"
                            formatDay={(_locale, date) => String(date.getDate())}
                            tileContent={tileContent}
                            value={selectedDate ? new Date(selectedDate + "T00:00:00") : new Date()}
                        />
                    </div>

                    {selectedDate && (
                        <div className="bg-white rounded-2xl shadow-sm p-5">
                            {selectedDiary ? (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs text-gray-400 font-semibold">{selectedDiary.display_date}</p>
                                        {isEditing ? (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={saveEdit}
                                                    disabled={isSaving}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition disabled:opacity-50"
                                                >
                                                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                                    保存
                                                </button>
                                                <button
                                                    onClick={cancelEditing}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition"
                                                >
                                                    <X size={13} />
                                                    取消
                                                </button>
                                            </div>
                                        ) : brushUpPreview ? (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={applyBrushUp}
                                                    disabled={isSaving}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-purple-500 hover:bg-purple-600 transition disabled:opacity-50"
                                                >
                                                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                                    適用
                                                </button>
                                                <button
                                                    onClick={cancelBrushUp}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition"
                                                >
                                                    <X size={13} />
                                                    やめる
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={loadVersions}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 bg-gray-50 hover:bg-gray-100 transition"
                                                >
                                                    <Clock size={13} />
                                                    履歴
                                                </button>
                                                <button
                                                    onClick={startBrushUp}
                                                    disabled={isBrushingUp}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 transition disabled:opacity-50"
                                                >
                                                    <Sparkles size={13} />
                                                    ブラッシュアップ
                                                </button>
                                                <button
                                                    onClick={startEditing}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition"
                                                >
                                                    <Edit3 size={13} />
                                                    編集
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {isEditing ? (
                                        <textarea
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            className="w-full min-h-[200px] p-3 text-sm text-gray-800 leading-relaxed rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                                        />
                                    ) : brushUpPreview ? (
                                        <>
                                            <p className="text-xs text-purple-500 font-semibold mb-2">✨ プレビュー</p>
                                            <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap p-3 rounded-xl bg-purple-50 border border-purple-100">
                                                {brushUpPreview}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                                            {selectedDiary.formatted_text}
                                        </div>
                                    )}

                                    {/* ブラッシュアップ指示入力 */}
                                    {showBrushUpInput && !brushUpPreview && (
                                        <div className="mt-3 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={brushUpInstruction}
                                                    onChange={(e) => setBrushUpInstruction(e.target.value)}
                                                    placeholder="指示を入力（例: もっとカジュアルに）"
                                                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-purple-400 placeholder:text-gray-300"
                                                    onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && brushUpInstruction.trim()) executeBrushUp(); }}
                                                    disabled={isBrushingUp}
                                                />
                                                <button
                                                    onClick={executeBrushUp}
                                                    disabled={isBrushingUp || !brushUpInstruction.trim()}
                                                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-white bg-purple-500 hover:bg-purple-600 transition disabled:opacity-50"
                                                >
                                                    {isBrushingUp ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                                </button>
                                                <button
                                                    onClick={cancelBrushUp}
                                                    className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>

                                        </div>
                                    )}

                                    {/* バージョン履歴 */}
                                    {showVersions && (
                                        <div className="mt-4 pt-3 border-t border-gray-100">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-xs text-gray-400 font-semibold">編集履歴</p>
                                                <button
                                                    onClick={() => setShowVersions(false)}
                                                    className="p-1 rounded-lg hover:bg-gray-100 transition"
                                                >
                                                    <X size={14} className="text-gray-400" />
                                                </button>
                                            </div>
                                            {versions.length === 0 ? (
                                                <p className="text-xs text-gray-400 py-2">編集履歴はありません</p>
                                            ) : (
                                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                                    {versions.map((v) => (
                                                        <div key={v.id} className="border border-gray-100 rounded-xl p-3">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-xs text-gray-400">{formatVersionDate(v.created_at)}</span>
                                                                <button
                                                                    onClick={() => restoreVersion(v)}
                                                                    disabled={isRestoringVersion}
                                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 transition disabled:opacity-50"
                                                                >
                                                                    {isRestoringVersion ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                                                                    復元
                                                                </button>
                                                            </div>
                                                            <p
                                                                onClick={() => setExpandedVersionId(expandedVersionId === v.id ? null : v.id)}
                                                                className={`text-xs text-gray-600 whitespace-pre-wrap cursor-pointer ${expandedVersionId === v.id ? "" : "line-clamp-3"}`}
                                                            >
                                                                {v.formatted_text}
                                                            </p>
                                                            {expandedVersionId !== v.id && (
                                                                <button
                                                                    onClick={() => setExpandedVersionId(v.id)}
                                                                    className="text-xs text-gray-400 hover:text-gray-600 mt-1 transition"
                                                                >
                                                                    もっと見る
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-4 pt-3 border-t border-gray-100">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-xs text-gray-400 font-semibold">元のメモ</p>
                                            {!isEditingMemo ? (
                                                <button
                                                    onClick={() => { setEditMemoText(selectedDiary.original_text); setIsEditingMemo(true); }}
                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-gray-500 bg-gray-50 hover:bg-gray-100 transition"
                                                >
                                                    <Edit3 size={12} />
                                                    編集
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={async () => {
                                                            setIsSavingMemo(true);
                                                            const { error } = await supabase
                                                                .from("diaries")
                                                                .update({ original_text: editMemoText, updated_at: new Date().toISOString() })
                                                                .eq("id", selectedDiary.id);
                                                            if (!error) {
                                                                const updated = { ...selectedDiary, original_text: editMemoText };
                                                                setSelectedDiary(updated);
                                                                setDiaries((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
                                                                setIsEditingMemo(false);
                                                            }
                                                            setIsSavingMemo(false);
                                                        }}
                                                        disabled={isSavingMemo}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition disabled:opacity-50"
                                                    >
                                                        {isSavingMemo ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                                        保存
                                                    </button>
                                                    <button
                                                        onClick={() => setIsEditingMemo(false)}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 transition"
                                                    >
                                                        <X size={12} />
                                                        取消
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        {isEditingMemo ? (
                                            <textarea
                                                value={editMemoText}
                                                onChange={(e) => setEditMemoText(e.target.value)}
                                                className="w-full min-h-[100px] p-2 text-xs text-gray-600 leading-relaxed rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                                            />
                                        ) : (
                                            <p className="text-xs text-gray-500 whitespace-pre-wrap">{selectedDiary.original_text}</p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <p className="text-sm text-gray-400">この日の日記はまだありません</p>
                                </div>
                            )}
                        </div>
                    )}
                </>)}
            </div>

            {/* Brushup Loading Overlay — blocks all interaction */}
            {isBrushingUp && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center"
                    style={{ touchAction: "none" }}
                    onClick={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.preventDefault()}
                >
                    <div className="bg-white rounded-3xl p-8 shadow-xl text-center space-y-4">
                        <Loader2 size={40} className="animate-spin text-purple-500 mx-auto" />
                        <p className="text-sm font-bold text-gray-700">ブラッシュアップ中...</p>
                        <p className="text-xs text-gray-400">少々お待ちください</p>
                    </div>
                </div>
            )}
        </div>
    );
}
