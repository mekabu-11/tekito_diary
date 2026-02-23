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
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
                <button onClick={() => router.push("/diary")} className="p-2 rounded-lg hover:bg-gray-100 transition">
                    <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <h1 className="text-lg font-extrabold text-gray-900">ユーザー管理</h1>
                <div className="flex-1" />
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition"
                >
                    <Plus size={16} /> 追加
                </button>
            </header>

            <div className="max-w-2xl mx-auto p-4 space-y-4">
                {/* Create Form */}
                {showCreate && (
                    <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
                        <h3 className="font-bold text-sm text-gray-700">新規ユーザー作成</h3>
                        {error && <p className="text-red-500 text-xs">{error}</p>}
                        <input type="text" placeholder="表示名" value={newName} onChange={(e) => setNewName(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
                        <input type="email" placeholder="メールアドレス" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-400" required />
                        <input type="password" placeholder="パスワード" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-400" required />
                        <div className="flex gap-2">
                            <button type="submit" disabled={creating} className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold disabled:opacity-50">
                                {creating ? "作成中..." : "作成"}
                            </button>
                            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">キャンセル</button>
                        </div>
                    </form>
                )}

                {/* Edit Modal */}
                {editingUser && (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
                        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-800">ユーザー編集</h3>
                                <button onClick={() => setEditingUser(null)} className="p-1 rounded-lg hover:bg-gray-100">
                                    <X size={18} className="text-gray-500" />
                                </button>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">表示名</label>
                                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">メールアドレス</label>
                                    <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 mb-1 block">ロール</label>
                                    <select value={editRole} onChange={(e) => setEditRole(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-emerald-400">
                                        <option value="user">user</option>
                                        <option value="admin">admin</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button onClick={handleSaveEdit} disabled={saving}
                                    className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1">
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                    {saving ? "保存中..." : "保存"}
                                </button>
                                <button onClick={() => setEditingUser(null)} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">キャンセル</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* User List */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-emerald-400" />
                    </div>
                ) : (
                    <div className="space-y-2">
                        {users.length === 0 && (
                            <p className="text-center text-gray-400 text-sm py-8">ユーザーがいません</p>
                        )}
                        {users.map((u) => (
                            <div key={u.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-gray-800 truncate">
                                        {u.displayName || <span className="text-gray-400">（名前なし）</span>}
                                    </p>
                                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${u.role === "admin" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                                    {u.role}
                                </span>
                                <button onClick={() => openEdit(u)} className="p-2 rounded-lg hover:bg-gray-100 transition" title="編集">
                                    <Edit3 size={16} className="text-gray-400" />
                                </button>
                                <button onClick={() => handleDelete(u.id, u.email)} className="p-2 rounded-lg hover:bg-red-50 transition" title="削除">
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
