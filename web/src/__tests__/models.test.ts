import { describe, it, expect } from "vitest";
import { AI_MODELS, DEFAULT_MODEL } from "@/lib/models";

describe("AI_MODELS", () => {
    it("モデル一覧が空でない", () => {
        expect(AI_MODELS.length).toBeGreaterThan(0);
    });

    it("各モデルに id と label がある", () => {
        for (const model of AI_MODELS) {
            expect(model.id).toBeTruthy();
            expect(model.label).toBeTruthy();
        }
    });

    it("デフォルトモデルがモデル一覧に含まれている", () => {
        const ids = AI_MODELS.map((m) => m.id);
        expect(ids).toContain(DEFAULT_MODEL);
    });
});
