"use client";
import { createClient } from "@/lib/supabase";
import { BookOpen, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { useState } from "react";

function translateError(msg: string): string {
    if (msg.includes("Invalid login credentials")) return "メールアドレスまたはパスワードが正しくありません";
    if (msg.includes("Email not confirmed")) return "メールアドレスが確認されていません";
    if (msg.includes("Too many requests")) return "試行回数が多すぎます。しばらく待ってから再試行してください";
    if (msg.includes("User not found")) return "ユーザーが見つかりません";
    if (msg.includes("Password should be at least")) return "パスワードは6文字以上で入力してください";
    if (msg.includes("Unable to validate email")) return "有効なメールアドレスを入力してください";
    if (msg.includes("network")) return "ネットワークエラーが発生しました。接続を確認してください";
    return msg; // fallback（翻訳できなかった場合はそのまま）
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
            window.location.href = "/diary";
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500 text-white mb-4">
                        <BookOpen size={32} />
                    </div>
                    <h1 className="text-2xl font-extrabold text-gray-900">てきとー日記</h1>
                    <p className="text-gray-500 mt-1 text-sm">適当に書くだけでAIが日記にしてくれる</p>
                </div>

                <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">メールアドレス</label>
                        <div className="relative">
                            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm"
                                placeholder="you@example.com"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">パスワード</label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-sm"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                                tabIndex={-1}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                        {isLoading ? "ログイン中..." : "ログイン"}
                    </button>
                </form>
            </div>
        </div>
    );
}
