"use client";

import { saveVersion } from "@/lib/diary-versions";
import { createClient } from "@/lib/supabase";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Edit3, History, Loader2, RotateCcw, X } from "lucide-react";
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

interface DiaryVersion {
    id: string;
    diary_id: string;
    formatted_text: string;
    original_text: string;
    version_number: number;
    created_at: string;
}

export default function HistoryContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialDate = searchParams.get("date");
    const supabase = createClient();

    const [diaries, setDiaries] = useState<Diary[]>([]);
    const [diaryDates, setDiaryDates] = useState<Set<string>>(new Set());
    const [selectedDate, setSelectedDate] = useState<string>(initialDate || (() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })());
    const [selectedDiary, setSelectedDiary] = useState<Diary | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [versions, setVersions] = useState<DiaryVersion[]>([]);
    const [showVersions, setShowVersions] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState<DiaryVersion | null>(null);
    const [isRestoringVersion, setIsRestoringVersion] = useState(false);

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

                if (initialDate) {
                    const found = data.find((d) => d.date === initialDate);
                    if (found) {
                        setSelectedDate(initialDate);
                        setSelectedDiary(found);
                        loadVersions(found.id);
                    }
                } else {
                    const todayDateKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;
                    const found = data.find((d) => d.date === todayDateKey);
                    if (found) {
                        setSelectedDiary(found);
                        loadVersions(found.id);
                    }
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

    const loadVersions = async (diaryId: string) => {
        const { data } = await supabase
            .from("diary_versions")
            .select("*")
            .eq("diary_id", diaryId)
            .order("version_number", { ascending: false });
        setVersions(data || []);
    };

    const handleDateClick = (date: Date) => {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        setSelectedDate(key);
        const found = diaries.find((d) => d.date === key);
        setSelectedDiary(found || null);
        setIsEditing(false);
        setShowVersions(false);
        setSelectedVersion(null);
        setVersions([]);
        if (found) loadVersions(found.id);
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
        await saveVersion(supabase, selectedDiary.id, selectedDiary.formatted_text, selectedDiary.original_text);
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
            await loadVersions(selectedDiary.id);
        }
        setIsSaving(false);
    };

    const restoreVersion = async (version: DiaryVersion) => {
        if (!selectedDiary) return;
        setIsRestoringVersion(true);
        await saveVersion(supabase, selectedDiary.id, selectedDiary.formatted_text, selectedDiary.original_text);
        const { error } = await supabase
            .from("diaries")
            .update({
                formatted_text: version.formatted_text,
                original_text: version.original_text,
                updated_at: new Date().toISOString(),
            })
            .eq("id", selectedDiary.id);

        if (!error) {
            const updated = { ...selectedDiary, formatted_text: version.formatted_text, original_text: version.original_text };
            setSelectedDiary(updated);
            setDiaries((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
            setSelectedVersion(null);
            await loadVersions(selectedDiary.id);
        }
        setIsRestoringVersion(false);
    };

    const tileContent = ({ date, view }: { date: Date; view: string }) => {
        if (view !== "month") return null;
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        if (diaryDates.has(key)) {
            return <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mx-auto mt-0.5" />;
        }
        return null;
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
                                        {!isEditing ? (
                                            <button
                                                onClick={startEditing}
                                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition"
                                            >
                                                <Edit3 size={13} />
                                                編集
                                            </button>
                                        ) : (
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
                                        )}
                                    </div>

                                    {isEditing ? (
                                        <textarea
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            className="w-full min-h-[200px] p-3 text-sm text-gray-800 leading-relaxed rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                                        />
                                    ) : (
                                        <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                                            {selectedDiary.formatted_text}
                                        </div>
                                    )}

                                    <div className="mt-4 pt-3 border-t border-gray-100">
                                        <p className="text-xs text-gray-400 font-semibold mb-1">元のメモ</p>
                                        <p className="text-xs text-gray-500 whitespace-pre-wrap">{selectedDiary.original_text}</p>
                                    </div>

                                    {versions.length > 0 && (
                                        <div className="mt-4 pt-3 border-t border-gray-100">
                                            <button
                                                onClick={() => { setShowVersions(!showVersions); setSelectedVersion(null); }}
                                                className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition"
                                            >
                                                <History size={13} />
                                                過去のバージョン ({versions.length})
                                                {showVersions ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                            </button>

                                            {showVersions && (
                                                <div className="mt-2 space-y-2">
                                                    {versions.map((v) => (
                                                        <button
                                                            key={v.id}
                                                            onClick={() => setSelectedVersion(selectedVersion?.id === v.id ? null : v)}
                                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs transition ${
                                                                selectedVersion?.id === v.id
                                                                    ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                                                                    : "bg-gray-50 hover:bg-gray-100 text-gray-600"
                                                            }`}
                                                        >
                                                            v{v.version_number} — {new Date(v.created_at).toLocaleString("ja-JP")}
                                                        </button>
                                                    ))}

                                                    {selectedVersion && (
                                                        <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
                                                            <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap mb-3">
                                                                {selectedVersion.formatted_text}
                                                            </div>
                                                            <button
                                                                onClick={() => restoreVersion(selectedVersion)}
                                                                disabled={isRestoringVersion}
                                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 transition disabled:opacity-50"
                                                            >
                                                                {isRestoringVersion ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                                                                このバージョンに戻す
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
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
        </div>
    );
}
