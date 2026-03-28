/**
 * /api/admin/users テスト
 *
 * 管理者専用ユーザー管理APIの権限チェック・
 * CRUD操作（GET/POST/DELETE/PATCH）をテストする。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuthGetUser = vi.fn();
const mockAdminFrom = vi.fn();
const mockAdminListUsers = vi.fn();
const mockAdminCreateUser = vi.fn();
const mockAdminDeleteUser = vi.fn();
const mockAdminUpdateUserById = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
    createServerSupabaseFromRequest: vi.fn(() => ({
        auth: { getUser: mockAuthGetUser },
    })),
    createAdminSupabase: vi.fn(async () => ({
        auth: {
            admin: {
                listUsers: mockAdminListUsers,
                createUser: mockAdminCreateUser,
                deleteUser: mockAdminDeleteUser,
                updateUserById: mockAdminUpdateUserById,
            },
        },
        from: mockAdminFrom,
    })),
}));

function createMockRequest(body?: unknown) {
    return {
        json: async () => body || {},
        cookies: { getAll: () => [] },
    } as never;
}

/** 管理者としてログイン */
function setAdmin() {
    mockAuthGetUser.mockResolvedValue({
        data: { user: { id: "admin-1" } },
    });
    // checkAdmin 内で admin role を確認するモック
    mockAdminFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                    data: { role: "admin" },
                }),
            }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
    });
}

/** 一般ユーザーとしてログイン */
function setNonAdmin() {
    mockAuthGetUser.mockResolvedValue({
        data: { user: { id: "user-1" } },
    });
    mockAdminFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                    data: { role: "user" },
                }),
            }),
        }),
    });
}

/** 未認証 */
function setUnauthenticated() {
    mockAuthGetUser.mockResolvedValue({
        data: { user: null },
    });
}

describe("GET /api/admin/users", () => {
    let GET: (req: never) => Promise<Response>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import("@/app/api/admin/users/route");
        GET = mod.GET;
    });

    it("未認証の場合 403 を返す", async () => {
        setUnauthenticated();
        const res = await GET(createMockRequest());
        expect(res.status).toBe(403);
    });

    it("一般ユーザーの場合 403 を返す", async () => {
        setNonAdmin();
        const res = await GET(createMockRequest());
        expect(res.status).toBe(403);
    });

    it("管理者がユーザー一覧を取得できる", async () => {
        setAdmin();
        mockAdminListUsers.mockResolvedValue({
            data: {
                users: [
                    { id: "u1", email: "a@test.com", created_at: "2026-01-01" },
                    { id: "u2", email: "b@test.com", created_at: "2026-02-01" },
                ],
            },
            error: null,
        });
        // profiles 取得モック（2回目の from 呼び出し）
        mockAdminFrom
            .mockReturnValueOnce({
                // checkAdmin 用
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: { role: "admin" } }),
                    }),
                }),
            })
            .mockReturnValueOnce({
                // profiles 一覧用
                select: vi.fn().mockResolvedValue({
                    data: [
                        { id: "u1", display_name: "ユーザーA", role: "admin" },
                        { id: "u2", display_name: "ユーザーB", role: "user" },
                    ],
                    error: null,
                }),
            });

        const res = await GET(createMockRequest());
        const json = await res.json();
        expect(json.users).toHaveLength(2);
        expect(json.users[0].displayName).toBe("ユーザーA");
        expect(json.users[1].role).toBe("user");
    });
});

describe("POST /api/admin/users", () => {
    let POST: (req: never) => Promise<Response>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import("@/app/api/admin/users/route");
        POST = mod.POST;
    });

    it("一般ユーザーの場合 403 を返す", async () => {
        setNonAdmin();
        const res = await POST(createMockRequest({
            email: "new@test.com",
            password: "pass123",
            displayName: "新規",
        }));
        expect(res.status).toBe(403);
    });

    it("管理者がユーザーを作成できる", async () => {
        setAdmin();
        mockAdminCreateUser.mockResolvedValue({
            data: { user: { id: "new-user-id", email: "new@test.com" } },
            error: null,
        });
        mockAdminFrom.mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: { role: "admin" } }),
                }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
        });

        const res = await POST(createMockRequest({
            email: "new@test.com",
            password: "pass123",
            displayName: "新規ユーザー",
        }));
        const json = await res.json();
        expect(json.user).toBeDefined();
        expect(json.user.email).toBe("new@test.com");
    });
});

describe("DELETE /api/admin/users", () => {
    let DELETE: (req: never) => Promise<Response>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import("@/app/api/admin/users/route");
        DELETE = mod.DELETE;
    });

    it("一般ユーザーの場合 403 を返す", async () => {
        setNonAdmin();
        const res = await DELETE(createMockRequest({ id: "target-user" }));
        expect(res.status).toBe(403);
    });

    it("管理者がユーザーを削除できる", async () => {
        setAdmin();
        mockAdminDeleteUser.mockResolvedValue({ error: null });
        const res = await DELETE(createMockRequest({ id: "target-user" }));
        const json = await res.json();
        expect(json.success).toBe(true);
    });
});

describe("PATCH /api/admin/users", () => {
    let PATCH: (req: never) => Promise<Response>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import("@/app/api/admin/users/route");
        PATCH = mod.PATCH;
    });

    it("一般ユーザーの場合 403 を返す", async () => {
        setNonAdmin();
        const res = await PATCH(createMockRequest({
            userId: "u1",
            displayName: "更新",
            role: "user",
        }));
        expect(res.status).toBe(403);
    });

    it("管理者がユーザー情報を更新できる", async () => {
        setAdmin();
        mockAdminUpdateUserById.mockResolvedValue({ error: null });
        mockAdminFrom.mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: { role: "admin" } }),
                }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
        });

        const res = await PATCH(createMockRequest({
            userId: "u1",
            email: "updated@test.com",
            displayName: "更新ユーザー",
            role: "admin",
        }));
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(mockAdminUpdateUserById).toHaveBeenCalledWith("u1", { email: "updated@test.com" });
    });

    it("email 変更なしの場合は Auth 更新をスキップする", async () => {
        setAdmin();
        mockAdminFrom.mockReturnValue({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: { role: "admin" } }),
                }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
        });

        const res = await PATCH(createMockRequest({
            userId: "u1",
            displayName: "更新ユーザー",
            role: "user",
        }));
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(mockAdminUpdateUserById).not.toHaveBeenCalled();
    });
});
