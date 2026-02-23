import { SupabaseClient } from "@supabase/supabase-js";

const MAX_VERSIONS = 3;

export async function saveVersion(
    supabase: SupabaseClient,
    diaryId: string,
    formattedText: string,
    originalText: string
) {
    // Get current max version_number for this diary
    const { data: existing } = await supabase
        .from("diary_versions")
        .select("id, version_number")
        .eq("diary_id", diaryId)
        .order("version_number", { ascending: false });

    const nextVersion = (existing?.[0]?.version_number ?? 0) + 1;

    // Insert the new version
    await supabase.from("diary_versions").insert({
        diary_id: diaryId,
        formatted_text: formattedText,
        original_text: originalText,
        version_number: nextVersion,
    });

    // Delete oldest versions if exceeding MAX_VERSIONS
    if (existing && existing.length >= MAX_VERSIONS) {
        const toDelete = existing
            .sort((a, b) => a.version_number - b.version_number)
            .slice(0, existing.length - MAX_VERSIONS + 1)
            .map((v) => v.id);
        await supabase.from("diary_versions").delete().in("id", toDelete);
    }
}
