import { describe, it, expect } from "vitest";
import { extractJsonObject, extractJsonArray } from "@/lib/parse-ai-json";

describe("extractJsonObject", () => {
    it("素のJSONオブジェクトをパースできる", () => {
        const result = extractJsonObject('{"todos":["買い物","掃除"]}');
        expect(result).toEqual({ todos: ["買い物", "掃除"] });
    });

    it("```json コードブロックからJSONを抽出できる", () => {
        const input = '```json\n{"profile":{"personality":["明るい"]}}\n```';
        const result = extractJsonObject(input);
        expect(result).toEqual({ profile: { personality: ["明るい"] } });
    });

    it("前後に説明テキストがあってもJSONを抽出できる", () => {
        const input = '以下がTODOです。\n{"todos":["散歩"]}\n以上です。';
        const result = extractJsonObject(input);
        expect(result).toEqual({ todos: ["散歩"] });
    });

    it("JSONが含まれない場合はnullを返す", () => {
        expect(extractJsonObject("特にTODOはありません")).toBeNull();
    });

    it("不正なJSONの場合はnullを返す", () => {
        expect(extractJsonObject("{invalid json}")).toBeNull();
    });

    it("空文字列の場合はnullを返す", () => {
        expect(extractJsonObject("")).toBeNull();
    });

    it("ネストされたオブジェクトを正しくパースできる", () => {
        const input = '{"profile":{"people":["太郎"],"places":["渋谷"]},"episodes":["映画を見た"]}';
        const result = extractJsonObject(input);
        expect(result).toEqual({
            profile: { people: ["太郎"], places: ["渋谷"] },
            episodes: ["映画を見た"],
        });
    });
});

describe("extractJsonArray", () => {
    it("素のJSON配列をパースできる", () => {
        const input = '[{"question":"どこで？","choices":["家","外"]}]';
        const result = extractJsonArray(input);
        expect(result).toEqual([{ question: "どこで？", choices: ["家", "外"] }]);
    });

    it("```json コードブロックから配列を抽出できる", () => {
        const input = '```json\n[{"date":"2026-03-20","score":4}]\n```';
        const result = extractJsonArray(input);
        expect(result).toEqual([{ date: "2026-03-20", score: 4 }]);
    });

    it("空配列をパースできる", () => {
        expect(extractJsonArray("[]")).toEqual([]);
    });

    it("配列が含まれない場合はnullを返す", () => {
        expect(extractJsonArray("質問はありません")).toBeNull();
    });

    it("前後に説明テキストがあっても配列を抽出できる", () => {
        const input = '質問一覧:\n[{"question":"何を食べた？","choices":["寿司","ラーメン"]}]\n以上';
        const result = extractJsonArray(input);
        expect(result).toHaveLength(1);
        expect(result![0]).toHaveProperty("question", "何を食べた？");
    });
});
