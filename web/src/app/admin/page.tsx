/**
 * 管理者ページ（app/admin/page.tsx）
 *
 * 管理者専用のユーザー管理画面。
 * ロールが "admin" のユーザーのみアクセス可能（非管理者は /diary にリダイレクト）。
 */
"use client";

import { ArrowLeft, Check, Edit3, Loader2, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface User {
    id: string;
    email: string;
    displayName: string;
    role: string;
    createdAt: string;
}

export default function AdminPage() {
    const router = useRouter();

    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [showCreate, setShowCreate] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");

    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editEmail, setEditEmail] = useState("");
    const [editName, setEditName] = useState("");
    const [editRole, setEditRole] = useState("");
    const [saving, setSaving] = useState(false);

    const loadUsers = useCallback(async () => {
        setIsLoading(true);
        const res = await fetch("/api/admin/users");
        const data = await res.json();
        setUsers(data.users || []);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        const checkAdminAndLoad = async () => {
            const res = await fetch("/api/auth/profile");
            if (!res.ok) { router.push("/login"); return; }
            const profile = await res.json();
            if (!profile.isAdmin) { router.push("/diary"); return; }
            await loadUsers();
        };
        checkAdminAndLoad();
    }, [router, loadUsers]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        setError("");

        const res = await fetch("/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: newEmail, password: newPassword, displayName: newName }),
        });
        const data = await res.json();

        if (data.error) {
            setError(data.error);
        } else {
            setNewEmail(""); setNewPassword(""); setNewName("");
            setShowCreate(false);
            await loadUsers();
        }
        setCreating(false);
    };

    const handleDelete = async (userId: string, email: string) => {
        if (!confirm(`${email} を削除しますか？`)) return;
        await fetch("/api/admin/users", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
        });
        await loadUsers();
    };

    const openEdit = (u: User) => {
        setEditingUser(u);
        setEditEmail(u.email);
        setEditName(u.displayName);
        setEditRole(u.role);
    };

    const handleSaveEdit = async () => {
        if (!editingUser) return;
        setSaving(true);
        await fetch("/api/admin/users", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                userId: editingUser.id,
                email: editEmail !== editingUser.email ? editEmail : undefined,
                displayName: editName,
                role: editRole,
            }),
        });
        setSaving(false);
        setEditingUser(null);
        await loadUsers();
    };

    return (
        <div className="min-h-screen bg-stone-50 dark:bg-slate-900 transition-colors duration-300">
            {/* ヘッダー */}
            <header className="bg-white dark:bg-slate-800 border-b border-stone-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
                <button onClick={() => router.push("/dashboard")} className="text-left group outline-none">
                    <h1 className="text-lg font-extrabold text-slate-800 dark:text-white transition group-hover:text-teal-600 dark:group-hover:text-teal-400">
                        てきとー日記
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 transition group-hover:text-teal-500">
                        ← ダッシュボードに戻る
                    </p>
                </button>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-stone-100 dark:bg-slate-700 px-2 py-1 rounded-lg">
                        管理画面
                    </span>
                    <button
                        onClick={() => setShowCreate(!showCreate)}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-teal-600 dark:bg-teal-500 text-white text-sm font-bold hover:bg-teal-700 dark:hover:bg-teal-600 transition"
                    >
                        <Plus size={16} /> 追加
                    </button>
                </div>
            </header>

            <div className="max-w-2xl mx-auto p-4 space-y-4">
                {/* 新規ユーザー作成フォーム */}
                {showCreate && (
                    <form onSubmit={handleCreate} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-stone-100 dark:border-slate-700 p-5 space-y-3">
                        <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">新規ユーザー作成</h3>
                        {error && <p className="text-red-500 dark:text-red-400 text-xs">{error}</p>}
                        <input type="text" placeholder="表示名" value={newName} onChange={(e) => setNewName(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-slate-300 dark:placeholder:text-slate-500" />
                        <input type="email" placeholder="メールアドレス" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-slate-300 dark:placeholder:text-slate-500" required />
                        <input type="password" placeholder="パスワード" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-400 placeholder:text-slate-300 dark:placeholder:text-slate-500" required />
                        <div className="flex gap-2">
                            <button type="submit" disabled={creating} className="flex-1 py-2 rounded-xl bg-teal-600 dark:bg-teal-500 text-white text-sm font-bold disabled:opacity-50">
                                {creating ? "作成中..." : "作成"}
                            </button>
                            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold">キャンセル</button>
                        </div>
                    </form>
                )}

                {/* ユーザー編集モーダル */}
                {editingUser && (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
                        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-stone-200 dark:border-slate-700 p-6 w-full max-w-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-slate-800 dark:text-slate-100">ユーザー編集</h3>
                                <button onClick={() => setEditingUser(null)} className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-700">
                                    <X size={18} className="text-slate-500 dark:text-slate-400" />
                                </button>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">表示名</label>
                                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-400" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">メールアドレス</label>
                                    <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-400" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">ロール</label>
                                    <select value={editRole} onChange={(e) => setEditRole(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-400">
                                        <option value="user">user</option>
                                        <option value="admin">admin</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button onClick={handleSaveEdit} disabled={saving}
                                    className="flex-1 py-2 rounded-xl bg-teal-600 dark:bg-teal-500 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1">
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                    {saving ? "保存中..." : "保存"}
                                </button>
                                <button onClick={() => setEditingUser(null)} className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold">キャンセル</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ユーザー一覧 */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-teal-400" />
                    </div>
                ) : (
                    <div className="space-y-2">
                        {users.length === 0 && (
                            <p className="text-center text-slate-400 dark:text-slate-500 text-sm py-8">ユーザーがいません</p>
                        )}
                        {users.map((u) => (
                            <div key={u.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-stone-100 dark:border-slate-700 p-4 flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">
                                        {u.displayName || <span className="text-slate-400 dark:text-slate-500">（名前なし）</span>}
                                    </p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{u.email}</p>
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${u.role === "admin" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" : "bg-stone-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>
                                    {u.role}
                                </span>
                                <button onClick={() => openEdit(u)} className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-slate-700 transition" title="編集">
                                    <Edit3 size={16} className="text-slate-400 dark:text-slate-500" />
                                </button>
                                <button onClick={() => handleDelete(u.id, u.email)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition" title="削除">
                                    <Trash2 size={16} className="text-red-400" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
