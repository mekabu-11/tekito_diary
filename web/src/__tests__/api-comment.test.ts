/**
 * POST /api/ai/comment テスト
 *
 * AIコメント生成APIの認証・空テキスト時デフォルト・
 * 正常レスポンス・nullフォールバック・エラーハンドリングをテストする。
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

describe("POST /api/ai/comment", () => {
    let POST: (req: never) => Promise<Response>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import("@/app/api/ai/comment/route");
        POST = mod.POST;
    });

    it("未認証の場合 401 を返す", async () => {
        setUnauthenticated();
        const res = await POST(createMockRequest({ texts: ["日記"] }));
        expect(res.status).toBe(401);
    });

    it("テキストが空配列の場合デフォルトメッセージを返す", async () => {
        setAuthenticated();
        const res = await POST(createMockRequest({ texts: [] }));
        const json = await res.json();
        expect(json.comment).toBe("日記を書いて、AIからのコメントをもらいましょう！");
    });

    it("テキストが未定義の場合デフォルトメッセージを返す", async () => {
        setAuthenticated();
        const res = await POST(createMockRequest({}));
        const json = await res.json();
        expect(json.comment).toBe("日記を書いて、AIからのコメントをもらいましょう！");
    });

    it("正常にコメントを生成して返す", async () => {
        setAuthenticated();
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: "充実した一日でしたね。" } }],
        });
        const res = await POST(createMockRequest({ texts: ["今日は楽しかった"] }));
        const json = await res.json();
        expect(json.comment).toBe("充実した一日でしたね。");
    });

    it("AI content が null の場合フォールバックメッセージを返す", async () => {
        setAuthenticated();
        mockCreate.mockResolvedValue({
            choices: [{ message: { content: null } }],
        });
        const res = await POST(createMockRequest({ texts: ["テスト"] }));
        const json = await res.json();
        expect(json.comment).toBe("今日も素敵な一日を");
    });

    it("OpenAI エラー時に 500 を返す", async () => {
        setAuthenticated();
        mockCreate.mockRejectedValue(new Error("Service unavailable"));
        const res = await POST(createMockRequest({ texts: ["テスト"] }));
        expect(res.status).toBe(500);
        expect((await res.json()).error).toBe("Service unavailable");
    });
});
