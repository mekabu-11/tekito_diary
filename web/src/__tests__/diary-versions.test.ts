/**
 * diary-versions ライブラリ テスト
 *
 * saveDiaryVersion / getDiaryVersions の
 * Supabase操作を正しく呼び出すことをテストする。
 */
import { describe, it, expect, vi } from "vitest";
import { saveDiaryVersion, getDiaryVersions } from "@/lib/diary-versions";

describe("saveDiaryVersion", () => {
    it("正しい引数で insert を呼ぶ", async () => {
        const mockInsert = vi.fn().mockResolvedValue({ data: {}, error: null });
        const mockSupabase = {
            from: vi.fn().mockReturnValue({ insert: mockInsert }),
        } as never;

        await saveDiaryVersion(
            mockSupabase,
            "diary-001",
            "user-123",
            "整形済みテキスト",
            "元のメモ",
        );

        expect(mockInsert).toHaveBeenCalledWith({
            diary_id: "diary-001",
            user_id: "user-123",
            formatted_text: "整形済みテキスト",
            original_text: "元のメモ",
        });
    });

    it("diary_versions テーブルに対して操作する", async () => {
        const mockFrom = vi.fn().mockReturnValue({
            insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
        });
        const mockSupabase = { from: mockFrom } as never;

        await saveDiaryVersion(mockSupabase, "d1", "u1", "text", "memo");
        expect(mockFrom).toHaveBeenCalledWith("diary_versions");
    });
});

describe("getDiaryVersions", () => {
    it("バージョン履歴を配列で返す", async () => {
        const mockVersions = [
            { id: "v2", diary_id: "d1", formatted_text: "v2テキスト", created_at: "2026-03-28" },
            { id: "v1", diary_id: "d1", formatted_text: "v1テキスト", created_at: "2026-03-27" },
        ];
        const mockSupabase = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        order: vi.fn().mockResolvedValue({ data: mockVersions }),
                    }),
                }),
            }),
        } as never;

        const result = await getDiaryVersions(mockSupabase, "d1");
        expect(result).toEqual(mockVersions);
        expect(result).toHaveLength(2);
    });

    it("データが null の場合は空配列を返す", async () => {
        const mockSupabase = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        order: vi.fn().mockResolvedValue({ data: null }),
                    }),
                }),
            }),
        } as never;

        const result = await getDiaryVersions(mockSupabase, "d1");
        expect(result).toEqual([]);
    });

    it("created_at 降順で取得する", async () => {
        const mockOrder = vi.fn().mockResolvedValue({ data: [] });
        const mockSupabase = {
            from: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        order: mockOrder,
                    }),
                }),
            }),
        } as never;

        await getDiaryVersions(mockSupabase, "d1");
        expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
    });
});
