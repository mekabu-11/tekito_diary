/**
 * POST /api/ai/weekly-report テスト
 *
 * 週間レポートAPIの認証・空テキスト・正常生成・
 * nullフォールバック・エラーハンドリングをテストする。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase-server", () => ({
    createServerSupabase: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
    })),
}));

const mockCreate = vi.fn();
vi.mock("openai", () => ({
    default: class {
        chat = { completions: { create: mockCreate } };
    },
}));

function createMockRequest(body: unknown) {
    return { json: async () => body } as never;
}

function setAuthenticated(id = "user-123") {
    mockGetUser.mockResolvedValue({ data: { user: { id } } });
}

function setUnauthenticated() {
    mockGetUser.mockResolvedValue({ data: { user: null } });
}

describe("POST /api/ai/weekly-report", () => {
    let POST: (req: never) => Promise<Response>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import("@/app/api/ai/weekly-report/route");
        POST = mod.POST;
    });

    it("未認証の場合 401 を返す", async () => {
        setUnauthenticated();
        const res = await POST(createMockRequest({
            texts: [{ date: "2026-03-24", text: "テスト" }],
        }));
        expect(res.status).toBe(401);
    });

    it("テキストが空の場合は空レポートを返す", async () => {
        setAuthenticated();
        const res = await POST(createMockRequest({ texts: [] }));
        const json = await res.json();
        expect(json.report).toBe("");
    });

    it("テキストが未定義の場合は空レポートを返す", async () => {
        setAuthenticated();
        const res = await POST(createMockRequest({}));
        const json = await res.json();
        expect(json.report).toBe("");
    });

    it("正常にレポートを生成して返す", async () => {
        setAuthenticated();
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: "今週は充実した一週間でした。" } }],
        });
        const res = await POST(createMockRequest({
            texts: [
                { date: "2026-03-24", text: "月曜日の日記" },
                { date: "2026-03-25", text: "火曜日の日記" },
            ],
        }));
        const json = await res.json();
        expect(json.report).toBe("今週は充実した一週間でした。");
    });

    it("AI content が null の場合は空文字列を返す", async () => {
        setAuthenticated();
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: null } }],
        });
        const res = await POST(createMockRequest({
            texts: [{ date: "2026-03-24", text: "テスト" }],
        }));
        const json = await res.json();
        expect(json.report).toBe("");
    });

    it("OpenAI エラー時に 500 を返す", async () => {
        setAuthenticated();
        mockCreate.mockRejectedValue(new Error("Internal server error"));
        const res = await POST(createMockRequest({
            texts: [{ date: "2026-03-24", text: "テスト" }],
        }));
        expect(res.status).toBe(500);
        expect((await res.json()).error).toBe("Internal server error");
    });
});
