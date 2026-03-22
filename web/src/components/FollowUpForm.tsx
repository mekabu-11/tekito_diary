/**
 * 深掘り質問フォーム（FollowUpForm）
 *
 * 日記生成フローの途中で表示されるモーダルコンポーネント。
 * AIが生成した深掘り質問に対して、ユーザーが選択肢から回答するか自由入力できる。
 */
"use client";

import { useState } from "react";

interface Question {
    question: string;
    choices: string[];
}

interface Props {
    questions: Question[];
    onSubmit: (answers: { question: string; answer: string }[]) => void;
    onSkip: () => void;
    onCancel: () => void;
    isLoading: boolean;
}

export default function FollowUpForm({ questions, onSubmit, onSkip, onCancel, isLoading }: Props) {
    const [answers, setAnswers] = useState<{ [idx: number]: string }>(
        () => Object.fromEntries(questions.map((_, i) => [i, ""]))
    );
    const [customInputs, setCustomInputs] = useState<{ [idx: number]: boolean }>(
        () => Object.fromEntries(questions.map((_, i) => [i, false]))
    );

    const selectChoice = (idx: number, choice: string) => {
        setCustomInputs((p) => ({ ...p, [idx]: false }));
        setAnswers((p) => ({ ...p, [idx]: choice }));
    };

    const handleSubmit = () => {
        onSubmit(questions.map((q, i) => ({ question: q.question, answer: answers[i] || "" })));
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
            <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-2xl sm:rounded-xl max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 dark:border-slate-700">
                {/* ヘッダー */}
                <div className="p-5 text-center border-b border-stone-100 dark:border-slate-700 relative">
                    <button onClick={onCancel} className="absolute top-4 left-4 text-teal-600 dark:text-teal-400 font-semibold text-sm" disabled={isLoading}>
                        戻る
                    </button>
                    <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">もう少し教えて</h2>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">回答すると日記がより具体的になります</p>
                </div>

                {/* 質問リスト */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {questions.map((q, idx) => (
                        <div key={idx} className="bg-stone-50 dark:bg-slate-700/50 rounded-xl p-4">
                            <p className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-3">{q.question}</p>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {q.choices.map((c, ci) => (
                                    <button
                                        key={ci}
                                        onClick={() => selectChoice(idx, c)}
                                        className={`px-3 py-2 rounded-full text-sm font-semibold transition ${!customInputs[idx] && answers[idx] === c
                                            ? "bg-teal-600 dark:bg-teal-500 text-white"
                                            : "bg-white dark:bg-slate-600 border border-teal-200 dark:border-slate-500 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-slate-500"
                                            }`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                            {customInputs[idx] ? (
                                <input
                                    className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-slate-300 dark:placeholder:text-slate-500"
                                    placeholder="自由に入力..."
                                    value={answers[idx]}
                                    onChange={(e) => setAnswers((p) => ({ ...p, [idx]: e.target.value }))}
                                    autoFocus
                                />
                            ) : (
                                <button
                                    onClick={() => { setCustomInputs((p) => ({ ...p, [idx]: true })); setAnswers((p) => ({ ...p, [idx]: "" })); }}
                                    className="text-xs text-slate-400 dark:text-slate-500 font-semibold"
                                >
                                    自分で入力する
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {/* アクションボタン */}
                <div className="p-5 border-t border-stone-100 dark:border-slate-700 space-y-2">
                    <button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="w-full py-3 rounded-xl bg-teal-600 dark:bg-teal-500 text-white font-bold text-sm hover:bg-teal-700 dark:hover:bg-teal-600 transition disabled:opacity-50"
                    >
                        {isLoading ? "日記を生成中..." : "この内容で日記にする"}
                    </button>
                    <button onClick={onSkip} disabled={isLoading} className="w-full py-2 text-sm text-slate-400 dark:text-slate-500 font-semibold">
                        スキップしてそのまま保存
                    </button>
                </div>
            </div>
        </div>
    );
}
