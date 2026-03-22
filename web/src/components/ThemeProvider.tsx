/**
 * テーマプロバイダー（ThemeProvider）
 *
 * アプリ全体のダーク/ライトモード切替を管理するコンテキストプロバイダー。
 * - localStorage にテーマ設定を永続化
 * - システム設定（prefers-color-scheme）をデフォルトとして使用
 * - <html> タグに "dark" クラスを付与/除去して Tailwind の dark: バリアントを有効化
 */
"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: "light",
    toggleTheme: () => {},
});

/** テーマコンテキストを取得するカスタムフック */
export const useTheme = () => useContext(ThemeContext);

/** テーマトグルボタンコンポーネント（ヘッダー等に配置） */
export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            title={theme === "dark" ? "ライトモードに切替" : "ダークモードに切替"}
        >
            {theme === "dark" ? "☀️" : "🌙"}
        </button>
    );
}

/**
 * テーマプロバイダーコンポーネント
 *
 * layout.tsx で <body> 内に配置し、全ページにテーマ情報を提供する。
 * 初期レンダリング時のちらつき（FOUC）を防ぐため、
 * マウント前は children を非表示にしない（SSR互換）。
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>("light");
    const [mounted, setMounted] = useState(false);

    // 初期化: localStorage → システム設定 の優先順位でテーマを決定
    useEffect(() => {
        const stored = localStorage.getItem("theme") as Theme | null;
        if (stored === "light" || stored === "dark") {
            setTheme(stored);
        } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
            setTheme("dark");
        }
        setMounted(true);
    }, []);

    // テーマ変更時に <html> のクラスと localStorage を更新
    useEffect(() => {
        if (!mounted) return;
        const root = document.documentElement;
        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
        localStorage.setItem("theme", theme);
    }, [theme, mounted]);

    /** ライト ↔ ダーク を切り替える */
    const toggleTheme = () => {
        setTheme((prev) => (prev === "light" ? "dark" : "light"));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}
