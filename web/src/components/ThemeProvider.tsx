/**
 * テーマプロバイダー（ThemeProvider）
 *
 * アプリ全体のダーク/ライトモード切替を管理するコンテキストプロバイダー。
 * - localStorage にテーマ設定を永続化
 * - システム設定（prefers-color-scheme）をデフォルトとして使用
 * - <html> タグに "dark" クラスを付与/除去して Tailwind の dark: バリアントを有効化
 */
"use client";

import { Moon, Sun } from "lucide-react";
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
            className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-700 transition"
            title={theme === "dark" ? "ライトモードに切替" : "ダークモードに切替"}
        >
            {theme === "dark" ? (
                <Sun size={18} className="text-amber-400" />
            ) : (
                <Moon size={18} className="text-slate-500" />
            )}
        </button>
    );
}

/**
 * テーマプロバイダーコンポーネント
 */
export default function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>("light");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem("theme") as Theme | null;
        if (stored === "light" || stored === "dark") {
            setTheme(stored);
        } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
            setTheme("dark");
        }
        setMounted(true);
    }, []);

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

    const toggleTheme = () => {
        setTheme((prev) => (prev === "light" ? "dark" : "light"));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}
