"use client";
export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase";
import { ArrowLeft, Edit3, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface User {
    id: string;
    email: string;
    displayName: string;
    role: string;
    createdAt: string;
}

export default function AdminPage() {
    const router = useRouter();
    const supabase = createClient();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [newEmail, setNewEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        checkAdminAndLoad();
    }, []);

    const checkAdminAndLoad = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push("/login"); return; }

        const { data } = await supabase.from("user_profiles").select("role").eq("id", user.id).single();
        if (data?.role !== "admin") { router.push("/diary"); return; }

        await loadUsers();
    };

    const loadUsers = async () => {
        setIsLoading(true);
        const res = await fetch("/api/admin/users");
        const data = await res.json();
        setUsers(data.users || []);
        setIsLoading(false);
    };

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
            setNewEmail("");
            setNewPassword("");
            setNewName("");
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

    const handleRoleToggle = async (userId: string, currentRole: string) => {
        const newRole = currentRole === "admin" ? "user" : "admin";
        await fetch("/api/admin/users", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, role: newRole }),
        });
        await loadUsers();
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
                <button onClick={() => router.push("/diary")} className="p-2 rounded-lg hover:bg-gray-100 transition">
                    <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <h1 className="text-lg font-extrabold text-gray-900">🛡️ ユーザー管理</h1>
                <div className="flex-1" />
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-indigo-500 text-white text-sm font-bold hover:bg-indigo-600 transition"
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
                        <input
                            type="text"
                            placeholder="表示名"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <input
                            type="email"
                            placeholder="メールアドレス"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                            required
                        />
                        <input
                            type="password"
                            placeholder="パスワード"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                            required
                        />
                        <div className="flex gap-2">
                            <button type="submit" disabled={creating} className="flex-1 py-2 rounded-xl bg-indigo-500 text-white text-sm font-bold disabled:opacity-50">
                                {creating ? "作成中..." : "作成"}
                            </button>
                            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">
                                キャンセル
                            </button>
                        </div>
                    </form>
                )}

                {/* User List */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-indigo-400" />
                    </div>
                ) : (
                    <div className="space-y-2">
                        {users.map((u) => (
                            <div key={u.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-gray-800 truncate">
                                        {u.displayName || u.email}
                                    </p>
                                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${u.role === "admin" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                                    {u.role}
                                </span>
                                <button onClick={() => handleRoleToggle(u.id, u.role)} className="p-2 rounded-lg hover:bg-gray-100 transition" title="権限変更">
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
