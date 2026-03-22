/**
 * 日記カレンダー・履歴ページ（HistoryContent）
 *
 * カレンダーUI で過去の日記を閲覧・編集・ブラッシュアップ・復元できるページ。
 * react-calendar ライブラリを使用してカレンダーを表示する。
 *
 * === 主な機能 ===
 * 1. **カレンダー表示**: 日記がある日にはドットマーカーを表示
 * 2. **日記閲覧**: 日付をクリックすると、その日の日記（整形済みテキスト）を表示
 * 3. **日記編集**: 整形済みテキストを直接編集して保存
 * 4. **元メモ編集**: ユーザーが入力した元のメモも編集可能
 * 5. **AIブラッシュアップ**: 日記を AI でリライト（指示入力可能、プレビュー→適用）
 * 6. **バージョン履歴**: 過去の編集・ブラッシュアップ前の状態を一覧表示＆復元
 *
 * === URLパラメータ ===
 * - ?date=YYYY-MM-DD : 初期表示で指定した日付を選択状態にする
 *   （日記生成後のリダイレクト時に使用）
 */
"use client";

import { DiaryVersion, getDiaryVersions, saveDiaryVersion } from "@/lib/diary-versions";
import { createClient } from "@/lib/supabase";
import { ArrowLeft, Check, Clock, Edit3, Loader2, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

/** diaries テーブルの1レコードに対応する型定義 */
interface Diary {
    id: string;
    date: string;            // "YYYY-MM-DD" 形式の日付キー
    display_date: string;    // 表示用の日本語日付（例: "2026年3月20日(金)"）
    original_text: string;   // ユーザーが入力した元のメモ
    formatted_text: string;  // AI が整形した日記テキスト
}

/** Date オブジェクトを "YYYY-MM-DD" 形式に変換するユーティリティ */
const toDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function HistoryContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialDate = searchParams.get("date"); // URL パラメータから初期日付を取得
    const supabase = createClient();

    // --- 日記データの状態 ---
    const [diaries, setDiaries] = useState<Diary[]>([]);                     // 全日記データ
    const [diaryDates, setDiaryDates] = useState<Set<string>>(new Set());    // 日記がある日付のセット（カレンダーのドット表示用）
    const [selectedDate, setSelectedDate] = useState<string>(initialDate || toDateKey(new Date())); // 選択中の日付
    const [selectedDiary, setSelectedDiary] = useState<Diary | null>(null);   // 選択中の日記データ
    const [isLoading, setIsLoading] = useState(true);                        // 初期ローディングフラグ

    // --- 日記編集の状態 ---
    const [isEditing, setIsEditing] = useState(false);     // 編集モードフラグ
    const [editText, setEditText] = useState("");          // 編集中のテキスト
    const [isSaving, setIsSaving] = useState(false);       // 保存中フラグ

    // --- バージョン履歴の状態 ---
    const [versions, setVersions] = useState<DiaryVersion[]>([]);        // バージョン一覧
    const [showVersions, setShowVersions] = useState(false);             // 履歴パネルの表示
    const [isRestoringVersion, setIsRestoringVersion] = useState(false); // 復元中フラグ
    const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null); // 展開表示中のバージョンID

    // --- 元メモ編集の状態 ---
    const [isEditingMemo, setIsEditingMemo] = useState(false);   // メモ編集モードフラグ
    const [editMemoText, setEditMemoText] = useState("");        // 編集中のメモテキスト
    const [isSavingMemo, setIsSavingMemo] = useState(false);     // メモ保存中フラグ

    // --- ブラッシュアップの状態 ---
    const [showBrushUpInput, setShowBrushUpInput] = useState(false);     // 指示入力欄の表示
    const [brushUpInstruction, setBrushUpInstruction] = useState("");     // ユーザーの指示テキスト
    const [isBrushingUp, setIsBrushingUp] = useState(false);             // ブラッシュアップ実行中
    const [brushUpPreview, setBrushUpPreview] = useState<string | null>(null); // プレビューテキスト

    // ========================================
    // データ読み込み
    // ========================================

    /**
     * ログインユーザーの全日記データを Supabase から取得する
     *
     * 取得後に以下を行う:
     * - 日記がある日付のセットを構築（カレンダーのドット表示用）
     * - URL パラメータ or 今日の日付に該当する日記を選択状態にする
     */
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
                // 日記がある日付を Set に格納（O(1) でルックアップ可能にする）
                setDiaryDates(new Set(data.map((d) => d.date)));

                // 初期日付 or 今日の日記を自動選択
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
    }, [initialDate]); // supabase インスタンスの変更では再実行しない

    /** ページマウント時に日記データを読み込む */
    useEffect(() => {
        loadDiaries();
    }, [loadDiaries]);

    // ========================================
    // カレンダー操作
    // ========================================

    /** カレンダーの日付がクリックされた時: 日記を選択し、各種編集状態をリセット */
    const handleDateClick = (date: Date) => {
        const key = toDateKey(date);
        setSelectedDate(key);
        const found = diaries.find((d) => d.date === key);
        setSelectedDiary(found || null);
        // すべての編集モード・パネルを閉じる
        setIsEditing(false);
        setIsEditingMemo(false);
        setShowVersions(false);
        setShowBrushUpInput(false);
        setBrushUpPreview(null);
    };

    // ========================================
    // ブラッシュアップ機能
    // ========================================

    /** ブラッシュアップモードを開始: 指示入力欄を表示 */
    const startBrushUp = () => {
        setShowBrushUpInput(true);
        setBrushUpInstruction("");
        setBrushUpPreview(null);
    };

    /**
     * ブラッシュアップを実行: /api/ai/brushup を呼び、プレビューテキストをセット
     * プレビュー表示後、ユーザーが「適用」or「やめる」を選択する
     */
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
            // エラー時は何もしない（プレビューが表示されないだけ）
        } finally {
            setIsBrushingUp(false);
        }
    };

    /**
     * ブラッシュアップの結果を適用:
     * 1. 現在の日記をバージョンとして保存（復元可能にする）
     * 2. formatted_text をブラッシュアップ後のテキストに更新
     */
    const applyBrushUp = async () => {
        if (!selectedDiary || !brushUpPreview) return;
        setIsSaving(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setIsSaving(false);
            return;
        }

        // 変更前の状態をバージョンとして保存
        await saveDiaryVersion(
            supabase,
            selectedDiary.id,
            user.id,
            selectedDiary.formatted_text,
            selectedDiary.original_text,
        );

        // ブラッシュアップ後のテキストで日記を更新
        const { error } = await supabase
            .from("diaries")
            .update({
                formatted_text: brushUpPreview,
                updated_at: new Date().toISOString(),
            })
            .eq("id", selectedDiary.id);

        if (!error) {
            // ローカルステートも更新（再フェッチ不要にする）
            const updated = { ...selectedDiary, formatted_text: brushUpPreview };
            setSelectedDiary(updated);
            setDiaries((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        }
        setBrushUpPreview(null);
        setShowBrushUpInput(false);
        setIsSaving(false);
    };

    /** ブラッシュアップをキャンセル: プレビューと指示をクリア */
    const cancelBrushUp = () => {
        setBrushUpPreview(null);
        setShowBrushUpInput(false);
        setBrushUpInstruction("");
    };

    // ========================================
    // 日記編集機能
    // ========================================

    /** 編集モードを開始: 現在の整形済みテキストを編集エリアにセット */
    const startEditing = () => {
        if (!selectedDiary) return;
        setEditText(selectedDiary.formatted_text);
        setIsEditing(true);
    };

    /** 編集をキャンセル */
    const cancelEditing = () => {
        setIsEditing(false);
        setEditText("");
    };

    /**
     * 編集内容を保存:
     * 1. 変更前の状態をバージョンとして保存
     * 2. formatted_text を新しいテキストに更新
     */
    const saveEdit = async () => {
        if (!selectedDiary) return;
        setIsSaving(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setIsSaving(false);
            return;
        }

        // 保存前にバージョンを記録（元に戻せるようにする）
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

    // ========================================
    // バージョン履歴機能
    // ========================================

    /** バージョン履歴を読み込んで表示する */
    const loadVersions = async () => {
        if (!selectedDiary) return;
        const v = await getDiaryVersions(supabase, selectedDiary.id);
        setVersions(v);
        setShowVersions(true);
    };

    /**
     * 過去のバージョンに復元する:
     * 1. 現在の状態をバージョンとして保存（復元の復元が可能）
     * 2. 選択したバージョンの formatted_text と original_text で日記を上書き
     * 3. バージョン一覧を再読み込み
     */
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

        // 選択したバージョンの内容で日記を更新
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
            // バージョン一覧を再読み込み（新しく保存したバージョンも表示するため）
            const v = await getDiaryVersions(supabase, selectedDiary.id);
            setVersions(v);
        }
        setIsRestoringVersion(false);
    };

    // ========================================
    // カレンダーカスタマイズ
    // ========================================

    /**
     * カレンダーのタイルコンテンツ: 日記がある日にエメラルドグリーンのドットを表示
     * react-calendar の tileContent prop に渡す
     */
    const tileContent = ({ date, view }: { date: Date; view: string }) => {
        if (view !== "month") return null;
        const key = toDateKey(date);
        if (diaryDates.has(key)) {
            return <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mx-auto mt-0.5" />;
        }
        return null;
    };

    /** バージョンの日時を日本語表示用にフォーマットする（例: "3月20日 14:30"） */
    const formatVersionDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleString("ja-JP", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // ========================================
    // レンダリング
    // ========================================

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ===== ヘッダー: 戻るボタンとタイトル ===== */}
            <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
                <button onClick={() => router.push("/diary")} className="p-2 rounded-lg hover:bg-gray-100 transition">
                    <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <h1 className="text-lg font-extrabold text-gray-900">日記カレンダー</h1>
            </header>

            <div className="max-w-lg mx-auto p-4 space-y-4">
                {isLoading ? (
                    /* ローディング表示 */
                    <div className="flex justify-center items-center py-20">
                        <Loader2 size={32} className="animate-spin text-emerald-500" />
                    </div>
                ) : (<>
                    {/* ===== カレンダーコンポーネント ===== */}
                    <div className="bg-white rounded-2xl shadow-sm p-4 calendar-wrapper">
                        <Calendar
                            onClickDay={handleDateClick}
                            locale="ja-JP"
                            formatDay={(_locale, date) => String(date.getDate())}
                            tileContent={tileContent}
                            value={selectedDate ? new Date(selectedDate + "T00:00:00") : new Date()}
                        />
                    </div>

                    {/* ===== 選択した日付の日記表示エリア ===== */}
                    {selectedDate && (
                        <div className="bg-white rounded-2xl shadow-sm p-5">
                            {selectedDiary ? (
                                <>
                                    {/* --- 日付ラベルとアクションボタン群 --- */}
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs text-gray-400 font-semibold">{selectedDiary.display_date}</p>
                                        {isEditing ? (
                                            /* 編集モード: 保存/取消ボタン */
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
                                            /* ブラッシュアップ プレビューモード: 適用/やめるボタン */
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
                                            /* 通常モード: 履歴/ブラッシュアップ/編集ボタン */
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

                                    {/* --- 日記本文表示エリア（モードに応じて切り替え） --- */}
                                    {isEditing ? (
                                        /* 編集モード: テキストエリア */
                                        <textarea
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            className="w-full min-h-[200px] p-3 text-sm text-gray-800 leading-relaxed rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                                        />
                                    ) : brushUpPreview ? (
                                        /* ブラッシュアップ プレビュー: 紫の背景で表示 */
                                        <>
                                            <p className="text-xs text-purple-500 font-semibold mb-2">✨ プレビュー</p>
                                            <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap p-3 rounded-xl bg-purple-50 border border-purple-100">
                                                {brushUpPreview}
                                            </div>
                                        </>
                                    ) : (
                                        /* 通常表示: 整形済みテキストをそのまま表示 */
                                        <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                                            {selectedDiary.formatted_text}
                                        </div>
                                    )}

                                    {/* --- ブラッシュアップ指示入力欄（プレビュー前のみ表示） --- */}
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
                                                {/* 実行ボタン */}
                                                <button
                                                    onClick={executeBrushUp}
                                                    disabled={isBrushingUp || !brushUpInstruction.trim()}
                                                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-white bg-purple-500 hover:bg-purple-600 transition disabled:opacity-50"
                                                >
                                                    {isBrushingUp ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                                </button>
                                                {/* キャンセルボタン */}
                                                <button
                                                    onClick={cancelBrushUp}
                                                    className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>

                                        </div>
                                    )}

                                    {/* --- バージョン履歴パネル --- */}
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
                                                                {/* バージョンの日時 */}
                                                                <span className="text-xs text-gray-400">{formatVersionDate(v.created_at)}</span>
                                                                {/* 復元ボタン */}
                                                                <button
                                                                    onClick={() => restoreVersion(v)}
                                                                    disabled={isRestoringVersion}
                                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 transition disabled:opacity-50"
                                                                >
                                                                    {isRestoringVersion ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                                                                    復元
                                                                </button>
                                                            </div>
                                                            {/* バージョンのテキスト（クリックで展開/折りたたみ） */}
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

                                    {/* --- 元のメモセクション（編集可能） --- */}
                                    <div className="mt-4 pt-3 border-t border-gray-100">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-xs text-gray-400 font-semibold">元のメモ</p>
                                            {!isEditingMemo ? (
                                                /* メモ編集ボタン */
                                                <button
                                                    onClick={() => { setEditMemoText(selectedDiary.original_text); setIsEditingMemo(true); }}
                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-gray-500 bg-gray-50 hover:bg-gray-100 transition"
                                                >
                                                    <Edit3 size={12} />
                                                    編集
                                                </button>
                                            ) : (
                                                /* メモ編集中: 保存/取消ボタン */
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
                                            /* メモ編集テキストエリア */
                                            <textarea
                                                value={editMemoText}
                                                onChange={(e) => setEditMemoText(e.target.value)}
                                                className="w-full min-h-[100px] p-2 text-xs text-gray-600 leading-relaxed rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
                                            />
                                        ) : (
                                            /* メモ閲覧表示 */
                                            <p className="text-xs text-gray-500 whitespace-pre-wrap">{selectedDiary.original_text}</p>
                                        )}
                                    </div>
                                </>
                            ) : (
                                /* 選択した日付に日記がない場合 */
                                <div className="text-center py-8">
                                    <p className="text-sm text-gray-400">この日の日記はまだありません</p>
                                </div>
                            )}
                        </div>
                    )}
                </>)}
            </div>

            {/* ===== ブラッシュアップ中のローディングオーバーレイ ===== */}
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
