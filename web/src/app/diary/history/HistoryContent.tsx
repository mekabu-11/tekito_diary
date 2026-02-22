"use client";

import { createClient } from "@/lib/supabase";
import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

interface Diary {
    id: string;
    date: string;
    display_date: string;
    original_text: string;
    formatted_text: string;
}

export default function HistoryContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialDate = searchParams.get("date");
    const supabase = createClient();

    const [diaries, setDiaries] = useState<Diary[]>([]);
    const [diaryDates, setDiaryDates] = useState<Set<string>>(new Set());
    const [selectedDate, setSelectedDate] = useState<string>(initialDate || "");
    const [selectedDiary, setSelectedDiary] = useState<Diary | null>(null);

    useEffect(() => {
        loadDiaries();
    }, []);

    const loadDiaries = async () => {
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

            if (initialDate) {
                const found = data.find((d) => d.date === initialDate);
                if (found) {
                    setSelectedDate(initialDate);
                    setSelectedDiary(found);
                }
            }
        }
    };

    const handleDateClick = (date: Date) => {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        setSelectedDate(key);
        const found = diaries.find((d) => d.date === key);
        setSelectedDiary(found || null);
    };

    const tileContent = ({ date, view }: { date: Date; view: string }) => {
        if (view !== "month") return null;
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
        if (diaryDates.has(key)) {
            return <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mx-auto mt-0.5" />;
        }
        return null;
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
                <button onClick={() => router.push("/diary")} className="p-2 rounded-lg hover:bg-gray-100 transition">
                    <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <h1 className="text-lg font-extrabold text-gray-900">📅 日記カレンダー</h1>
            </header>

            <div className="max-w-lg mx-auto p-4 space-y-4">
                <div className="bg-white rounded-2xl shadow-sm p-4 calendar-wrapper">
                    <Calendar
                        onClickDay={handleDateClick}
                        locale="ja-JP"
                        tileContent={tileContent}
                        value={selectedDate ? new Date(selectedDate + "T00:00:00") : new Date()}
                    />
                </div>

                {selectedDate && (
                    <div className="bg-white rounded-2xl shadow-sm p-5">
                        {selectedDiary ? (
                            <>
                                <p className="text-xs text-gray-400 font-semibold mb-2">{selectedDiary.display_date}</p>
                                <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                                    {selectedDiary.formatted_text}
                                </div>
                                <div className="mt-4 pt-3 border-t border-gray-100">
                                    <p className="text-xs text-gray-400 font-semibold mb-1">📝 元のメモ</p>
                                    <p className="text-xs text-gray-500 whitespace-pre-wrap">{selectedDiary.original_text}</p>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <p className="text-4xl mb-2">📝</p>
                                <p className="text-sm text-gray-400">この日の日記はまだありません</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
