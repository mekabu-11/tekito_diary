/**
 * POST /api/ai/brushup テスト
 *
 * 日記ブラッシュアップAPIの認証・バリデーション・レスポンス形式・
 * 指示あり/なし分岐・箇条書き除去をテストする。
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

function setAIResponse(content: string) {
    mockCreate.mockResolvedValue({
        choices: [{ message: { content } }],
    });
}

describe("POST /api/ai/brushup", () => {
    let POST: (req: never) => Promise<Response>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import("@/app/api/ai/brushup/route");
        POST = mod.POST;
    });

    it("未認証の場合 401 を返す", async () => {
        setUnauthenticated();
        const res = await POST(createMockRequest({ text: "テスト" }));
        expect(res.status).toBe(401);
        expect((await res.json()).error).toBe("Unauthorized");
    });

    it("テキストが空の場合 400 を返す", async () => {
        setAuthenticated();
        const res = await POST(createMockRequest({ text: "" }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe("テキストが必要です");
    });

    it("テキストが未定義の場合 400 を返す", async () => {
        setAuthenticated();
        const res = await POST(createMockRequest({}));
        expect(res.status).toBe(400);
    });

    it("指示なしでブラッシュアップされたテキストを返す", async () => {
        setAuthenticated();
        setAIResponse("今日は天気が良く、散歩を楽しんだ。");
        const res = await POST(createMockRequest({ text: "天気よかった散歩した" }));
        const json = await res.json();
        expect(json.brushedUp).toBe("今日は天気が良く、散歩を楽しんだ。");
    });

    it("指示ありでブラッシュアップする（プロンプトに指示が含まれる）", async () => {
        setAuthenticated();
        setAIResponse("今日はええ天気やったから散歩したわ。");
        const res = await POST(createMockRequest({
            text: "天気よかった散歩した",
            instruction: "関西弁にして",
        }));
        const json = await res.json();
        expect(json.brushedUp).toBeDefined();
        // プロンプトに instruction が含まれていることを確認
        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.messages[0].content).toContain("関西弁にして");
    });

    it("箇条書き記号がレスポンスから除去される", async () => {
        setAuthenticated();
        setAIResponse("- 朝ごはんを食べた\n・ 散歩に行った\n• コーヒーを飲んだ");
        const res = await POST(createMockRequest({ text: "テスト" }));
        const json = await res.json();
        expect(json.brushedUp).not.toContain("- ");
        expect(json.brushedUp).not.toContain("・ ");
        expect(json.brushedUp).not.toContain("• ");
    });

    it("OpenAI エラー時に 500 を返す", async () => {
        setAuthenticated();
        mockCreate.mockRejectedValue(new Error("API rate limit exceeded"));
        const res = await POST(createMockRequest({ text: "テスト" }));
        expect(res.status).toBe(500);
        expect((await res.json()).error).toBe("API rate limit exceeded");
    });
});
