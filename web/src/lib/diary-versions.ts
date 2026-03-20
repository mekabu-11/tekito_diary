/**
 * 日記バージョン管理ユーティリティ
 *
 * 日記を編集・ブラッシュアップ・復元するたびに、変更前の状態をバージョンとして保存する。
 * これにより、ユーザーは過去の状態に戻す（復元）ことができる。
 *
 * テーブル: diary_versions
 * - 1つの日記 (diary_id) に対して複数のバージョンが紐づく
 * - created_at の降順で取得 → 最新のバージョンが先頭
 */
import { SupabaseClient } from "@supabase/supabase-js";

/** diary_versions テーブルの1レコードに対応する型定義 */
export interface DiaryVersion {
    id: string;           // バージョンの一意な ID（UUID）
    diary_id: string;     // 紐づく日記の ID
    user_id: string;      // バージョンを作成したユーザーの ID
    formatted_text: string; // AI が整形した日記テキスト（変更前のもの）
    original_text: string;  // ユーザーが入力した元のメモ（変更前のもの）
    created_at: string;     // バージョンが保存された日時
}

/**
 * 日記の現在の状態をバージョンとして保存する
 *
 * 日記を編集・ブラッシュアップ・復元する直前に呼び出し、
 * 変更前のテキストをスナップショットとして diary_versions テーブルに記録する。
 *
 * @param supabase - Supabase クライアントインスタンス
 * @param diaryId - 対象の日記 ID
 * @param userId - 操作を行ったユーザー ID
 * @param formattedText - 変更前の整形済みテキスト
 * @param originalText - 変更前の元メモ
 */
export async function saveDiaryVersion(
    supabase: SupabaseClient,
    diaryId: string,
    userId: string,
    formattedText: string,
    originalText: string,
) {
    return supabase.from("diary_versions").insert({
        diary_id: diaryId,
        user_id: userId,
        formatted_text: formattedText,
        original_text: originalText,
    });
}

/**
 * 特定の日記に紐づくバージョン履歴を取得する
 *
 * 最新のバージョンから順番に返す（created_at 降順）。
 * 履歴画面でユーザーが過去のバージョンを確認・復元するために使用する。
 *
 * @param supabase - Supabase クライアントインスタンス
 * @param diaryId - 対象の日記 ID
 * @returns バージョン履歴の配列（最新順）
 */
export async function getDiaryVersions(
    supabase: SupabaseClient,
    diaryId: string,
): Promise<DiaryVersion[]> {
    const { data } = await supabase
        .from("diary_versions")
        .select("*")
        .eq("diary_id", diaryId)
        .order("created_at", { ascending: false });
    return data || [];
}
