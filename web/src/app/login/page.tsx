/**
 * ログインページ（app/login/page.tsx）
 *
 * Supabase Auth を使ったメール・パスワード認証のログインフォーム。
 * ログイン成功時は /dashboard にリダイレクトする。
 */
"use client";

import { createClient } from "@/lib/supabase";
import { BookOpen, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { useState } from "react";

/** Supabase Auth のエラーメッセージを日本語に翻訳する */
function translateError(msg: string): string {
    if (msg.includes("Invalid login credentials")) return "メールアドレスまたはパスワードが正しくありません";
    if (msg.includes("Email not confirmed")) return "メールアドレスが確認されていません";
    if (msg.includes("Too many requests")) return "試行回数が多すぎます。しばらく待ってから再試行してください";
    if (msg.includes("User not found")) return "ユーザーが見つかりません";
    if (msg.includes("Password should be at least")) return "パスワードは6文字以上で入力してください";
    if (msg.includes("Unable to validate email")) return "有効なメールアドレスを入力してください";
    if (msg.includes("network")) return "ネットワークエラーが発生しました。接続を確認してください";
    return msg;
}

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setError(translateError(error.message));
            setIsLoading(false);
        } else {
            window.location.href = "/dashboard";
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-slate-900 px-4 transition-colors duration-300">
            <div className="w-full max-w-sm">
                {/* アプリロゴ・タイトルセクション */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-teal-600 dark:bg-teal-500 text-white mb-4">
                        <BookOpen size={32} />
                    </div>
                    <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">てきとー日記</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">適当に書くだけでAIが日記にしてくれる</p>
                </div>

                {/* ログインフォーム */}
                <form onSubmit={handleLogin} className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-stone-200 dark:border-slate-700 p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-lg">{error}</div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">メールアドレス</label>
                        <div className="relative">
                            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-lg border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition text-sm placeholder:text-slate-300 dark:placeholder:text-slate-500"
                                placeholder="you@example.com"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">パスワード</label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-11 py-3 rounded-lg border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition text-sm placeholder:text-slate-300 dark:placeholder:text-slate-500"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 rounded-xl bg-teal-600 dark:bg-teal-500 text-white font-bold text-sm hover:bg-teal-700 dark:hover:bg-teal-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                        {isLoading ? "ログイン中..." : "ログイン"}
                    </button>
                </form>
            </div>
        </div>
    );
}
