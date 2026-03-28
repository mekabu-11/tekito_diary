/**
 * POST /api/ai/format テスト
 *
 * メモ→日記整形APIの認証・新規/マージモード分岐・
 * answersセクション構築・箇条書き除去・エラーハンドリングをテストする。
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

describe("POST /api/ai/format", () => {
    let POST: (req: never) => Promise<Response>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import("@/app/api/ai/format/route");
        POST = mod.POST;
    });

    it("未認証の場合 401 を返す", async () => {
        setUnauthenticated();
        const res = await POST(createMockRequest({ text: "テスト" }));
        expect(res.status).toBe(401);
    });

    it("新規モードで日記を整形して返す", async () => {
        setAuthenticated();
        setAIResponse("今日はカレーを食べた。おいしかった。");
        const res = await POST(createMockRequest({
            text: "カレー食べた うまかった",
            currentTime: "19時00分",
        }));
        const json = await res.json();
        expect(json.formatted).toBe("今日はカレーを食べた。おいしかった。");
    });

    it("マージモードで既存メモと統合する", async () => {
        setAuthenticated();
        setAIResponse("朝はジョギングをし、夜はカレーを食べた。");
        const res = await POST(createMockRequest({
            text: "カレー食べた",
            existingText: "朝ジョギングした",
            currentTime: "20時00分",
        }));
        const json = await res.json();
        expect(json.formatted).toBeDefined();
        // マージモードのプロンプトに既存テキストが含まれる
        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.messages[0].content).toContain("朝ジョギングした");
        expect(callArgs.messages[0].content).toContain("カレー食べた");
    });

    it("answers がある場合プロンプトに追加の詳細セクションが含まれる", async () => {
        setAuthenticated();
        setAIResponse("整形結果");
        const res = await POST(createMockRequest({
            text: "カレー食べた",
            currentTime: "19時00分",
            answers: [
                { question: "どこで食べましたか？", answer: "店で" },
                { question: "誰と？", answer: "一人で" },
            ],
        }));
        const json = await res.json();
        expect(json.formatted).toBeDefined();
        // プロンプトに回答が含まれる
        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.messages[0].content).toContain("店で");
        expect(callArgs.messages[0].content).toContain("一人で");
    });

    it("空の回答はフィルタされる", async () => {
        setAuthenticated();
        setAIResponse("整形結果");
        await POST(createMockRequest({
            text: "テスト",
            currentTime: "12時00分",
            answers: [
                { question: "Q1", answer: "回答あり" },
                { question: "Q2", answer: "   " }, // 空白のみ → フィルタされる
            ],
        }));
        const callArgs = mockCreate.mock.calls[0][0];
        expect(callArgs.messages[0].content).toContain("回答あり");
        // Q2 は空なのでフィルタ
        expect(callArgs.messages[0].content).not.toContain("Q2");
    });

    it("箇条書き記号がレスポンスから除去される", async () => {
        setAuthenticated();
        setAIResponse("- 朝食を食べた\n・ 買い物に行った\n• 掃除をした");
        const res = await POST(createMockRequest({
            text: "テスト",
            currentTime: "18時00分",
        }));
        const json = await res.json();
        expect(json.formatted).not.toContain("- ");
        expect(json.formatted).not.toContain("・ ");
        expect(json.formatted).not.toContain("• ");
    });

    it("OpenAI エラー時に 500 を返す", async () => {
        setAuthenticated();
        mockCreate.mockRejectedValue(new Error("Timeout"));
        const res = await POST(createMockRequest({
            text: "テスト",
            currentTime: "18時00分",
        }));
        expect(res.status).toBe(500);
    });
});
