/**
 * 深掘り質問フォーム（FollowUpForm）
 *
 * 日記生成フローの途中で表示されるモーダルコンポーネント。
 * AIが生成した深掘り質問に対して、ユーザーが選択肢から回答するか自由入力できる。
 * 回答内容は日記整形API（/api/ai/format）に渡され、より具体的な日記が生成される。
 *
 * 表示タイミング:
 * diary/page.tsx の startGeneration() 内で questions API を呼び、
 * 質問がある場合にこのフォームが表示される。
 *
 * ユーザーの選択肢:
 * 1. 質問に回答して「この内容で日記にする」 → onSubmit
 * 2. 「スキップしてそのまま保存」 → onSkip（回答なしで日記生成）
 * 3. 「✕ 戻る」 → onCancel（フォームを閉じて入力画面に戻る）
 */
"use client";

import { useState } from "react";

/** 1つの深掘り質問の型（質問文と選択肢のセット） */
interface Question {
    question: string;
    choices: string[];
}

/** コンポーネントの Props */
interface Props {
    questions: Question[];                                        // AI が生成した質問リスト
    onSubmit: (answers: { question: string; answer: string }[]) => void; // 回答を送信
    onSkip: () => void;                                          // スキップ（回答なしで日記生成）
    onCancel: () => void;                                        // キャンセル（入力画面に戻る）
    isLoading: boolean;                                          // 日記生成中フラグ
}

export default function FollowUpForm({ questions, onSubmit, onSkip, onCancel, isLoading }: Props) {
    // 各質問の回答を管理するstate（キー: 質問のインデックス、値: 回答テキスト）
    const [answers, setAnswers] = useState<{ [idx: number]: string }>(
        () => Object.fromEntries(questions.map((_, i) => [i, ""]))
    );
    // 各質問で自由入力モードかどうかを管理（falseの場合は選択肢モード）
    const [customInputs, setCustomInputs] = useState<{ [idx: number]: boolean }>(
        () => Object.fromEntries(questions.map((_, i) => [i, false]))
    );

    /** 選択肢をタップした時: 自由入力モードを解除して選択肢を回答にセット */
    const selectChoice = (idx: number, choice: string) => {
        setCustomInputs((p) => ({ ...p, [idx]: false }));
        setAnswers((p) => ({ ...p, [idx]: choice }));
    };

    /** 送信: 各質問と回答をペアにして親コンポーネントに渡す */
    const handleSubmit = () => {
        onSubmit(questions.map((q, i) => ({ question: q.question, answer: answers[i] || "" })));
    };

    return (
        /* フルスクリーンのモーダルオーバーレイ */
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
            <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* ヘッダー: タイトルと戻るボタン */}
                <div className="p-5 text-center border-b border-gray-100">
                    <button onClick={onCancel} className="absolute top-4 left-4 text-emerald-500 font-semibold text-sm" disabled={isLoading}>
                        ✕ 戻る
                    </button>
                    <h2 className="text-lg font-extrabold text-gray-900">もう少し教えて！</h2>
                    <p className="text-xs text-gray-400 mt-1">回答すると日記がより具体的になります</p>
                </div>

                {/* 質問リスト: スクロール可能なエリア */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {questions.map((q, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-2xl p-4">
                            {/* 質問文 */}
                            <p className="font-bold text-sm text-gray-800 mb-3">{q.question}</p>
                            {/* 選択肢ボタン群 */}
                            <div className="flex flex-wrap gap-2 mb-2">
                                {q.choices.map((c, ci) => (
                                    <button
                                        key={ci}
                                        onClick={() => selectChoice(idx, c)}
                                        className={`px-3 py-2 rounded-full text-sm font-semibold transition ${!customInputs[idx] && answers[idx] === c
                                            ? "bg-emerald-500 text-white"
                                            : "bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                            }`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                            {/* 自由入力モード: テキスト入力欄 or 「自分で入力する」ボタン */}
                            {customInputs[idx] ? (
                                <input
                                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-400"
                                    placeholder="自由に入力..."
                                    value={answers[idx]}
                                    onChange={(e) => setAnswers((p) => ({ ...p, [idx]: e.target.value }))}
                                    autoFocus
                                />
                            ) : (
                                <button
                                    onClick={() => { setCustomInputs((p) => ({ ...p, [idx]: true })); setAnswers((p) => ({ ...p, [idx]: "" })); }}
                                    className="text-xs text-gray-400 font-semibold"
                                >
                                    自分で入力する
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* アクションボタン: 送信 / スキップ */}
                <div className="p-5 border-t border-gray-100 space-y-2">
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition disabled:opacity-50"
                    >
                        {isLoading ? "日記を生成中..." : "この内容で日記にする"}
                    </button>
                    <button onClick={onSkip} disabled={isLoading} className="w-full py-2 text-sm text-gray-400 font-semibold">
                        スキップしてそのまま保存
                    </button>
                </div>
            </div>
        </div>
    );
}
