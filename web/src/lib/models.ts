/**
 * AI モデル定義
 *
 * アプリケーション全体で使用する AI モデルの一覧とデフォルト設定を管理する。
 * 管理者はヘッダーのドロップダウンからモデルを選択でき、ここで定義されたモデルが表示される。
 */

/** 選択可能な AI モデルの一覧（管理者向けドロップダウンに表示される） */
export const AI_MODELS = [
    { id: "gpt-5.4-mini", label: "gpt-5.4-mini" },
    { id: "gpt-5.1", label: "gpt-5.1" },
    { id: "gpt-5-mini", label: "gpt-5-mini" },
] as const;

/** 管理者がモデルを選択していない場合のデフォルトモデル */
export const DEFAULT_MODEL = "gpt-5.4-mini";
