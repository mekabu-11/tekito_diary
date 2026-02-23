import { SupabaseClient } from "@supabase/supabase-js";

export interface DiaryVersion {
    id: string;
    diary_id: string;
    user_id: string;
    formatted_text: string;
    original_text: string;
    created_at: string;
}

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
