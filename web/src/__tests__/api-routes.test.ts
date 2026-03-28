/**
 * API ルート統合テスト
 *
 * Supabase と OpenAI をモックして、各 AI API ルートの
 * 認証チェック・リクエストバリデーション・レスポンス形式をテストする。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- モック定義 ---

// Supabase のモック（認証済み/未認証をテストごとに切り替え可能）
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
    createServerSupabase: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    })),
}));

// OpenAI のモック（AI レスポンスを自由にセット可能）
const mockCreate = vi.fn();

vi.mock("openai", () => ({
    default: class {
        chat = { completions: { create: mockCreate } };
    },
}));

// NextRequest のモック
function createMockRequest(body: unknown) {
    return { json: async () => body } as never;
}

// --- ヘルパー ---

/** 認証済みユーザーをセット */
function setAuthenticatedUser(id = "user-123") {
    mockGetUser.mockResolvedValue({ data: { user: { id } } });
}

/** 未認証状態をセット */
function setUnauthenticated() {
    mockGetUser.mockResolvedValue({ data: { user: null } });
}

/** OpenAI のレスポンスをセット */
function setAIResponse(content: string) {
    mockCreate.mockResolvedValue({
        choices: [{ message: { content } }],
    });
}

// --- テストスイート ---

describe("POST /api/ai/todos", () => {
    let POST: (req: never) => Promise<Response>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import("@/app/api/ai/todos/route");
        POST = mod.POST;
        // Supabase の from().delete().eq().eq() チェーンをモック
        mockFrom.mockReturnValue({
            delete: () => ({
                eq: () => ({ eq: () => Promise.resolve() }),
            }),
            insert: vi.fn().mockResolvedValue({}),
        });
    });

    it("未認証の場合 401 を返す", async () => {
        setUnauthenticated();
        const req = createMockRequest({ diaryText: "テスト", dateKey: "2026-03-28" });
        const res = await POST(req);
        expect(res.status).toBe(401);
        const json = await res.json();
        expect(json.error).toBe("Unauthorized");
    });

    it("正常にTODOを抽出して返す", async () => {
        setAuthenticatedUser();
        setAIResponse('{"todos":["買い物に行く","部屋を掃除する"]}');
        const req = createMockRequest({ diaryText: "今日は買い物と掃除をしなきゃ", dateKey: "2026-03-28" });
        const res = await POST(req);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.todos).toEqual(["買い物に行く", "部屋を掃除する"]);
    });

    it("AIがJSONを返さない場合でも空配列を返す", async () => {
        setAuthenticatedUser();
        setAIResponse("特にTODOはありません。");
        const req = createMockRequest({ diaryText: "のんびりした一日", dateKey: "2026-03-28" });
        const res = await POST(req);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.todos).toEqual([]);
    });
});

describe("POST /api/ai/questions", () => {
    let POST: (req: never) => Promise<Response>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import("@/app/api/ai/questions/route");
        POST = mod.POST;
    });

    it("未認証の場合 401 を返す", async () => {
        setUnauthenticated();
        const req = createMockRequest({ text: "カレー食べた" });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("正常に質問を返す", async () => {
        setAuthenticatedUser();
        setAIResponse('[{"question":"どこで食べましたか？","choices":["家","外食","テイクアウト"]}]');
        const req = createMockRequest({ text: "カレー食べた" });
        const res = await POST(req);
        const json = await res.json();
        expect(json.questions).toHaveLength(1);
        expect(json.questions[0]).toHaveProperty("question");
        expect(json.questions[0]).toHaveProperty("choices");
    });

    it("質問は最大10件に制限される", async () => {
        setAuthenticatedUser();
        const manyQuestions = Array.from({ length: 15 }, (_, i) => ({
            question: `質問${i + 1}`,
            choices: ["A", "B"],
        }));
        setAIResponse(JSON.stringify(manyQuestions));
        const req = createMockRequest({ text: "テスト" });
        const res = await POST(req);
        const json = await res.json();
        expect(json.questions).toHaveLength(10);
    });

    it("AIが空配列を返した場合は空の質問リストを返す", async () => {
        setAuthenticatedUser();
        setAIResponse("[]");
        const req = createMockRequest({ text: "今日は朝起きて、公園で30分ジョギングした後、シャワーを浴びて朝食にトーストを食べた" });
        const res = await POST(req);
        const json = await res.json();
        expect(json.questions).toEqual([]);
    });
});

describe("POST /api/ai/mood", () => {
    let POST: (req: never) => Promise<Response>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import("@/app/api/ai/mood/route");
        POST = mod.POST;
    });

    it("未認証の場合 401 を返す", async () => {
        setUnauthenticated();
        const req = createMockRequest({ texts: [{ date: "2026-03-28", text: "楽しかった" }] });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("テキストが空の場合は空のスコアを返す", async () => {
        setAuthenticatedUser();
        const req = createMockRequest({ texts: [] });
        const res = await POST(req);
        const json = await res.json();
        expect(json.scores).toEqual([]);
    });

    it("配列形式のレスポンスを正しく処理する", async () => {
        setAuthenticatedUser();
        setAIResponse('[{"date":"2026-03-28","score":4}]');
        const req = createMockRequest({ texts: [{ date: "2026-03-28", text: "いい天気だった" }] });
        const res = await POST(req);
        const json = await res.json();
        expect(json.scores).toEqual([{ date: "2026-03-28", score: 4 }]);
    });

    it("オブジェクト形式のレスポンスを正しく処理する", async () => {
        setAuthenticatedUser();
        setAIResponse('{"scores":[{"date":"2026-03-28","score":3}]}');
        const req = createMockRequest({ texts: [{ date: "2026-03-28", text: "普通の一日" }] });
        const res = await POST(req);
        const json = await res.json();
        expect(json.scores).toEqual([{ date: "2026-03-28", score: 3 }]);
    });
});

describe("POST /api/ai/learn", () => {
    let POST: (req: never) => Promise<Response>;

    beforeEach(async () => {
        vi.clearAllMocks();
        const mod = await import("@/app/api/ai/learn/route");
        POST = mod.POST;
        // Supabase チェーンモック
        mockFrom.mockReturnValue({
            upsert: vi.fn().mockResolvedValue({}),
            insert: vi.fn().mockResolvedValue({}),
            delete: () => ({ in: vi.fn().mockResolvedValue({}) }),
            select: () => ({
                eq: () => ({
                    order: () => Promise.resolve({ data: [] }),
                }),
            }),
        });
    });

    it("未認証の場合 401 を返す", async () => {
        setUnauthenticated();
        const req = createMockRequest({
            diaryText: "テスト日記",
            originalMemo: "テスト",
            dateKey: "2026-03-28",
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("正常にプロファイルを抽出して返す", async () => {
        setAuthenticatedUser();
        const aiResponse = JSON.stringify({
            profile: {
                personality: ["明るい"],
                people: ["太郎"],
                places: ["東京"],
                work: [],
                lifestyle: [],
                preferences: ["カレー"],
            },
            episodes: ["友達と東京で遊んだ"],
        });
        setAIResponse(aiResponse);
        const req = createMockRequest({
            diaryText: "太郎と東京でカレーを食べた",
            originalMemo: "太郎とカレー",
            dateKey: "2026-03-28",
            currentProfile: {},
        });
        const res = await POST(req);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.profile).toHaveProperty("personality");
        expect(json.profile.people).toContain("太郎");
    });

    it("AIがJSONを返さない場合でもエラーにならない", async () => {
        setAuthenticatedUser();
        setAIResponse("情報を抽出できませんでした。");
        const req = createMockRequest({
            diaryText: "...",
            originalMemo: "...",
            dateKey: "2026-03-28",
        });
        const res = await POST(req);
        const json = await res.json();
        expect(json.profile).toBeNull();
        expect(json.episodes).toEqual([]);
    });
});
