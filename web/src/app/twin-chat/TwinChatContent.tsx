/**
 * デジタルツインAI チャット コンテンツ（TwinChatContent）
 *
 * ユーザーの日記データ・性格・価値観をもとにした
 * 「もう一人の自分」AIとリアルタイムで対話するチャットUI。
 *
 * === 仕組み ===
 * 1. /api/ai/twin-chat にメッセージ履歴を送信
 * 2. SSE（Server-Sent Events）でストリーミング受信
 * 3. 逐次的にメッセージを描画
 * 4. 会話履歴は localStorage に一時保存
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { ArrowLeft, Loader2, Send, Sparkles, Trash2, User } from "lucide-react";

// === 型定義 ===

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

const STORAGE_KEY = "twin_chat_history";

export default function TwinChatContent() {
    const router = useRouter();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);

    // 会話履歴をローカルストレージから復元
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                setMessages(JSON.parse(saved));
            }
        } catch { /* ignore */ }
    }, []);

    // 会話履歴をローカルストレージに保存
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
        }
    }, [messages]);

    // 最新メッセージまで自動スクロール
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

    // メッセージ送信
    const sendMessage = async () => {
        const text = input.trim();
        if (!text || isStreaming) return;

        const userMessage: ChatMessage = { role: "user", content: text };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput("");
        setIsStreaming(true);

        // アシスタントの返答を空文字で追加（ストリーミングで埋めていく）
        const assistantMessage: ChatMessage = { role: "assistant", content: "" };
        setMessages([...newMessages, assistantMessage]);

        try {
            const res = await fetch("/api/ai/twin-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: newMessages }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                        role: "assistant",
                        content: `エラーが発生しました: ${errorData.error || "通信エラー"}`,
                    };
                    return updated;
                });
                setIsStreaming(false);
                return;
            }

            // ストリーミング読み取り
            const reader = res.body?.getReader();
            if (!reader) {
                setIsStreaming(false);
                return;
            }

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        if (data === "[DONE]") break;
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                setMessages(prev => {
                                    const updated = [...prev];
                                    const last = updated[updated.length - 1];
                                    updated[updated.length - 1] = {
                                        ...last,
                                        content: last.content + parsed.content,
                                    };
                                    return updated;
                                });
                            }
                        } catch { /* ignore parse errors */ }
                    }
                }
            }
        } catch {
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                    role: "assistant",
                    content: "通信エラーが発生しました。もう一度お試しください。",
                };
                return updated;
            });
        } finally {
            setIsStreaming(false);
        }
    };

    // 会話リセット
    const clearChat = () => {
        setMessages([]);
        localStorage.removeItem(STORAGE_KEY);
    };

    // Enter で送信（Shift+Enter で改行）
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div className="min-h-screen bg-stone-50 dark:bg-slate-900 flex flex-col transition-colors duration-300">
            {/* ヘッダー */}
            <header className="bg-white dark:bg-slate-800 border-b border-stone-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3 shrink-0">
                <button
                    onClick={() => router.push("/dashboard")}
                    className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-700 transition"
                >
                    <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                        <Sparkles size={20} className="text-violet-500" />
                        もう一人の自分と対話
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        あなたの日記から学んだAIと壁打ち
                    </p>
                </div>
                {messages.length > 0 && (
                    <button
                        onClick={clearChat}
                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                        title="会話をリセット"
                    >
                        <Trash2 size={18} className="text-red-400" />
                    </button>
                )}
            </header>

            {/* メッセージエリア */}
            <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-20 gap-4">
                        <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                            <Sparkles size={28} className="text-violet-500" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-1">
                                あなたの分身AIです
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-[280px]">
                                あなたの日記から学んだ性格・価値観・経験をもとに、
                                一緒に考えたり相談に乗ったりします。
                            </p>
                        </div>
                        <div className="space-y-2 w-full max-w-[280px]">
                            {[
                                "最近の自分ってどう思う？",
                                "転職を考えてるんだけど、どう思う？",
                                "今週末なにしようかな",
                            ].map((suggestion) => (
                                <button
                                    key={suggestion}
                                    onClick={() => {
                                        setInput(suggestion);
                                        inputRef.current?.focus();
                                    }}
                                    className="w-full text-left px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-900/15 hover:border-violet-200 dark:hover:border-violet-800 transition"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                {msg.role === "assistant" && (
                                    <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0 mt-1">
                                        <Sparkles size={14} className="text-violet-500" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                                        msg.role === "user"
                                            ? "bg-teal-600 dark:bg-teal-500 text-white rounded-br-md"
                                            : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-stone-100 dark:border-slate-700 rounded-bl-md shadow-sm"
                                    }`}
                                >
                                    {msg.content || (
                                        <span className="flex items-center gap-1.5 text-slate-400">
                                            <Loader2 size={12} className="animate-spin" />
                                            考え中...
                                        </span>
                                    )}
                                </div>
                                {msg.role === "user" && (
                                    <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center shrink-0 mt-1">
                                        <User size={14} className="text-teal-600 dark:text-teal-400" />
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* 入力エリア */}
            <div className="shrink-0 bg-white dark:bg-slate-800 border-t border-stone-200 dark:border-slate-700 px-4 py-3 max-w-lg mx-auto w-full">
                <div className="flex gap-2 items-end">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="メッセージを入力..."
                        rows={1}
                        className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-stone-200 dark:border-slate-600 bg-stone-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-400 dark:focus:ring-violet-500 focus:border-transparent resize-none max-h-32"
                        style={{ minHeight: "42px" }}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim() || isStreaming}
                        className="shrink-0 w-10 h-10 rounded-xl bg-violet-500 text-white hover:bg-violet-600 transition flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        {isStreaming ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Send size={18} />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
