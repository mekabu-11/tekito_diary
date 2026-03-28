/**
 * POST /api/ai/social-graph テスト
 *
 * 人間関係グラフ生成APIの認証・空データ時の空配列返却・
 * 正常系のAIレスポンスパース・OpenAIエラーハンドリングをテストする。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ===== Supabase モック =====
const mockGetUser = vi.fn();
const mockProfileSelect = vi.fn();
const mockProfileEq = vi.fn();
const mockProfileSingle = vi.fn();
const mockDiarySelect = vi.fn();
const mockDiaryEq = vi.fn();
const mockDiaryOrder = vi.fn();
const mockDiaryLimit = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
    createServerSupabase: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
        from: (table: string) => {
            if (table === "core_profiles") {
                return {
                    select: mockProfileSelect.mockReturnValue({
                        eq: mockProfileEq.mockReturnValue({
                            single: mockProfileSingle,
                        }),
                    }),
                };
            }
            if (table === "diaries") {
                return {
                    select: mockDiarySelect.mockReturnValue({
                        eq: mockDiaryEq.mockReturnValue({
                            order: mockDiaryOrder.mockReturnValue({
                                limit: mockDiaryLimit,
                            }),
                        }),
                    }),
                };
            }
            return { select: vi.fn() };
        },
    })),
}));

// ===== OpenAI モック =====
const mockCreate = vi.fn();
vi.mock("openai", () => ({
    default: class {
        chat = { completions: { create: mockCreate } };
    },
}));

// ===== ヘルパー関数 =====

function createMockRequest() {
    return { json: async () => ({}) } as never;
}

function setAuthenticated(id = "user-123") {
    mockGetUser.mockResolvedValue({ data: { user: { id } } });
}

function setUnauthenticated() {
    mockGetUser.mockResolvedValue({ data: { user: null } });
}

function setProfileData(people: string[] | null) {
    mockProfileSingle.mockResolvedValue({
        data: people !== null ? { people } : null,
    });
}

function setDiaryData(diaries: { date: string; formatted_text: string }[]) {
    mockDiaryLimit.mockResolvedValue({ data: diaries });
}

// ===== テスト =====

describe("POST /api/ai/social-graph", () => {
    let POST: (req: never) => Promise<Response>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import("@/app/api/ai/social-graph/route");
        POST = mod.POST;
    });

    it("未認証の場合 401 を返す", async () => {
        setUnauthenticated();
        const res = await POST(createMockRequest());
        expect(res.status).toBe(401);
    });

    it("people が空で日記もない場合、空配列を返す", async () => {
        setAuthenticated();
        setProfileData([]);
        setDiaryData([]);
        const res = await POST(createMockRequest());
        const json = await res.json();
        expect(json.people).toEqual([]);
    });

    it("people が null で日記もない場合、空配列を返す", async () => {
        setAuthenticated();
        setProfileData(null);
        setDiaryData([]);
        const res = await POST(createMockRequest());
        const json = await res.json();
        expect(json.people).toEqual([]);
    });

    it("正常系: AIレスポンスからグラフデータを返す", async () => {
        setAuthenticated();
        setProfileData(["太郎", "花子"]);
        setDiaryData([
            { date: "2026-03-25", formatted_text: "太郎と映画を観た。" },
            { date: "2026-03-26", formatted_text: "花子とランチした。" },
        ]);

        const aiResponse = JSON.stringify([
            {
                name: "太郎",
                relation: "友人",
                lastSeen: "2026-03-25",
                frequency: 5,
                moodImpact: "positive",
                episodes: ["映画を一緒に観た"],
                suggestion: "最近よく遊んでいますね。",
            },
            {
                name: "花子",
                relation: "同僚",
                lastSeen: "2026-03-26",
                frequency: 3,
                moodImpact: "neutral",
                episodes: ["ランチをした"],
                suggestion: null,
            },
        ]);

        mockCreate.mockResolvedValue({
            choices: [{ message: { content: aiResponse } }],
        });

        const res = await POST(createMockRequest());
        const json = await res.json();
        expect(json.people).toHaveLength(2);
        expect(json.people[0].name).toBe("太郎");
        expect(json.people[0].relation).toBe("友人");
        expect(json.people[1].name).toBe("花子");
    });

    it("AIレスポンスがコードブロックで囲まれていてもパースできる", async () => {
        setAuthenticated();
        setProfileData(["太郎"]);
        setDiaryData([{ date: "2026-03-25", formatted_text: "太郎と遊んだ。" }]);

        const aiResponse = "```json\n" + JSON.stringify([
            {
                name: "太郎",
                relation: "友人",
                lastSeen: "2026-03-25",
                frequency: 1,
                moodImpact: "positive",
                episodes: [],
                suggestion: null,
            },
        ]) + "\n```";

        mockCreate.mockResolvedValue({
            choices: [{ message: { content: aiResponse } }],
        });

        const res = await POST(createMockRequest());
        const json = await res.json();
        expect(json.people).toHaveLength(1);
        expect(json.people[0].name).toBe("太郎");
    });

    it("OpenAI エラー時に 500 を返す", async () => {
        setAuthenticated();
        setProfileData(["太郎"]);
        setDiaryData([{ date: "2026-03-25", formatted_text: "日記テスト" }]);

        mockCreate.mockRejectedValue(new Error("Service unavailable"));

        const res = await POST(createMockRequest());
        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json.error).toBe("Service unavailable");
    });
});
