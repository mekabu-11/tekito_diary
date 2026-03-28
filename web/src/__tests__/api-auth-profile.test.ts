/**
 * GET /api/auth/profile テスト
 *
 * ユーザープロファイルAPIの認証・プロファイルあり/なし・
 * admin判定をテストする。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const mockAdminFrom = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
    createServerSupabase: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
    })),
    createAdminSupabase: vi.fn(async () => ({
        from: mockAdminFrom,
    })),
}));

// auth/profile は GET で引数なし
function createMockRequest() {
    return {} as never;
}

describe("GET /api/auth/profile", () => {
    let GET: () => Promise<Response>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import("@/app/api/auth/profile/route");
        GET = mod.GET;
    });

    it("未認証の場合 401 を返す", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } });
        const res = await GET();
        expect(res.status).toBe(401);
    });

    it("プロフィールが存在する場合、正しい情報を返す", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: { id: "user-123", email: "test@example.com" } },
        });
        mockAdminFrom.mockReturnValue({
            select: () => ({
                eq: () => ({
                    single: () => Promise.resolve({
                        data: { role: "admin", display_name: "テストユーザー" },
                    }),
                }),
            }),
        });

        const res = await GET();
        const json = await res.json();
        expect(json.email).toBe("test@example.com");
        expect(json.role).toBe("admin");
        expect(json.displayName).toBe("テストユーザー");
        expect(json.isAdmin).toBe(true);
    });

    it("プロフィールが存在しない場合、デフォルト値を返す", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: { id: "user-456", email: "noname@example.com" } },
        });
        mockAdminFrom.mockReturnValue({
            select: () => ({
                eq: () => ({
                    single: () => Promise.resolve({ data: null }),
                }),
            }),
        });

        const res = await GET();
        const json = await res.json();
        expect(json.role).toBe("user");
        expect(json.displayName).toBe("noname@example.com");
        expect(json.isAdmin).toBe(false);
    });

    it("role が user の場合 isAdmin が false になる", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: { id: "user-789", email: "normal@example.com" } },
        });
        mockAdminFrom.mockReturnValue({
            select: () => ({
                eq: () => ({
                    single: () => Promise.resolve({
                        data: { role: "user", display_name: "一般ユーザー" },
                    }),
                }),
            }),
        });

        const res = await GET();
        const json = await res.json();
        expect(json.isAdmin).toBe(false);
        expect(json.role).toBe("user");
    });
});
