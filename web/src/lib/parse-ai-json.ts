/**
 * AI レスポンスから JSON を安全に抽出するユーティリティ
 *
 * AI の出力には ```json コードブロックや説明テキストが含まれることがあるため、
 * それらを除去して純粋な JSON 部分だけを抽出する。
 */

/**
 * AI レスポンスから JSON オブジェクト ({...}) を抽出してパースする
 * @returns パース結果。JSON が見つからない場合は null
 */
export function extractJsonObject(raw: string): Record<string, unknown> | null {
    const cleaned = stripCodeBlock(raw);
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
        return JSON.parse(match[0]);
    } catch {
        return null;
    }
}

/**
 * AI レスポンスから JSON 配列 ([...]) を抽出してパースする
 * @returns パース結果。JSON が見つからない場合は null
 */
export function extractJsonArray(raw: string): unknown[] | null {
    const cleaned = stripCodeBlock(raw);
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return null;
    try {
        const result = JSON.parse(match[0]);
        return Array.isArray(result) ? result : null;
    } catch {
        return null;
    }
}

/**
 * マークダウンのコードブロック記法を除去する
 */
function stripCodeBlock(raw: string): string {
    return raw.replace(/^```json/im, "").replace(/```$/m, "").trim();
}
