/**
 * ログインページ（app/login/page.tsx）
 *
 * Supabase Auth を使ったメール・パスワード認証のログインフォーム。
 * ログイン成功時は /diary にリダイレクトする。
 *
 * 機能:
 * - メールアドレス・パスワードによるログイン
 * - パスワードの表示/非表示トグル
 * - エラーメッセージの日本語翻訳
 * - ローディング状態の表示
 */
"use client";

import { createClient } from "@/lib/supabase";
import { BookOpen, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { useState } from "react";

/**
 * Supabase Auth のエラーメッセージを日本語に翻訳する
 * Supabase のエラーは英語で返されるため、ユーザーにわかりやすい日本語に変換する
 */
function translateError(msg: string): string {
    if (msg.includes("Invalid login credentials")) return "メールアドレスまたはパスワードが正しくありません";
    if (msg.includes("Email not confirmed")) return "メールアドレスが確認されていません";
    if (msg.includes("Too many requests")) return "試行回数が多すぎます。しばらく待ってから再試行してください";
    if (msg.includes("User not found")) return "ユーザーが見つかりません";
    if (msg.includes("Password should be at least")) return "パスワードは6文字以上で入力してください";
    if (msg.includes("Unable to validate email")) return "有効なメールアドレスを入力してください";
    if (msg.includes("network")) return "ネットワークエラーが発生しました。接続を確認してください";
    return msg; // 翻訳できなかった場合はそのまま表示
}

export default function LoginPage() {
    // --- 状態管理 ---
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);  // パスワード表示/非表示
    const [isLoading, setIsLoading] = useState(false);        // ログイン処理中フラグ
    const [error, setError] = useState("");                   // エラーメッセージ
    const supabase = createClient();

    /**
     * ログインフォーム送信ハンドラ
     * Supabase Auth でメール・パスワード認証を実行し、
     * 成功時は /diary にリダイレクト、失敗時はエラーメッセージを表示する
     */
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setError(translateError(error.message));
            setIsLoading(false);
        } else {
            // ログイン成功: window.location で完全なページ遷移（Cookie の反映を確実にするため）
            window.location.href = "/diary";
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4">
            <div className="w-full max-w-sm">
                {/* アプリロゴ・タイトルセクション */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500 text-white mb-4">
                        <BookOpen size={32} />
                    </div>
                    <h1 className="text-2xl font-extrabold text-gray-900">てきとー日記</h1>
                    <p className="text-gray-500 mt-1 text-sm">適当に書くだけでAIが日記にしてくれる</p>
                </div>

                {/* ログインフォーム */}
                <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
                    {/* エラーメッセージ表示 */}
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
                    )}

                    {/* メールアドレス入力 */}
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

                    {/* パスワード入力（表示/非表示トグル付き） */}
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
                            {/* 目のアイコンでパスワード表示/非表示を切り替え */}
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

                    {/* ログインボタン */}
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
