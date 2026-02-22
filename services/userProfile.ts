import AsyncStorage from '@react-native-async-storage/async-storage';

const CORE_PROFILE_KEY = '@tekito_diary_core_profile';
const EPISODES_KEY = '@tekito_diary_episodes';
const MAX_EPISODES = 50;

// ─── A. コアプロファイル（永続・上書き型）─────────────
// 「カレーが好き」「新宿によく行く」「妻がいる」等
// AIが追記・修正する1つのオブジェクト

export interface CoreProfile {
    personality: string[];    // 性格・趣味嗜好
    people: string[];         // 人間関係（妻、友人○○等）
    places: string[];         // よく行く場所・お気に入りの店
    work: string[];           // 仕事・学校関連
    lifestyle: string[];      // 生活パターン・習慣
    preferences: string[];    // 好み（食事、音楽等）
    updatedAt: number;
}

const EMPTY_PROFILE: CoreProfile = {
    personality: [],
    people: [],
    places: [],
    work: [],
    lifestyle: [],
    preferences: [],
    updatedAt: Date.now(),
};

export const getCoreProfile = async (): Promise<CoreProfile> => {
    try {
        const str = await AsyncStorage.getItem(CORE_PROFILE_KEY);
        if (!str) return { ...EMPTY_PROFILE };
        return JSON.parse(str) as CoreProfile;
    } catch {
        return { ...EMPTY_PROFILE };
    }
};

export const saveCoreProfile = async (profile: CoreProfile): Promise<void> => {
    await AsyncStorage.setItem(CORE_PROFILE_KEY, JSON.stringify({
        ...profile,
        updatedAt: Date.now(),
    }));
};

export const formatCoreProfileForPrompt = async (): Promise<string> => {
    const p = await getCoreProfile();
    const sections: string[] = [];

    if (p.personality.length > 0) sections.push(`性格・趣味: ${p.personality.join('、')}`);
    if (p.people.length > 0) sections.push(`人間関係: ${p.people.join('、')}`);
    if (p.places.length > 0) sections.push(`よく行く場所: ${p.places.join('、')}`);
    if (p.work.length > 0) sections.push(`仕事: ${p.work.join('、')}`);
    if (p.lifestyle.length > 0) sections.push(`生活習慣: ${p.lifestyle.join('、')}`);
    if (p.preferences.length > 0) sections.push(`好み: ${p.preferences.join('、')}`);

    if (sections.length === 0) return '';
    return sections.join('\n');
};

// ─── B. エピソード記憶（FIFO・直近の文脈）─────────────
// 「昨日○○のプロジェクトで疲れていた」「今週は外食が続いている」等

export interface Episode {
    content: string;
    date: string;
    createdAt: number;
}

export const getEpisodes = async (): Promise<Episode[]> => {
    try {
        const str = await AsyncStorage.getItem(EPISODES_KEY);
        if (!str) return [];
        return JSON.parse(str) as Episode[];
    } catch {
        return [];
    }
};

export const addEpisodes = async (newEpisodes: Episode[]): Promise<void> => {
    const existing = await getEpisodes();
    const updated = [...existing, ...newEpisodes].slice(-MAX_EPISODES);
    await AsyncStorage.setItem(EPISODES_KEY, JSON.stringify(updated));
};

export const formatEpisodesForPrompt = async (): Promise<string> => {
    const episodes = await getEpisodes();
    if (episodes.length === 0) return '';

    // 直近10件だけプロンプトに含める（トークン節約）
    const recent = episodes.slice(-10);
    return recent.map((e) => `- [${e.date}] ${e.content}`).join('\n');
};

// ─── 統合コンテキスト ─────────────────────────────

export const getFullContext = async (): Promise<string> => {
    const coreStr = await formatCoreProfileForPrompt();
    const episodesStr = await formatEpisodesForPrompt();

    const parts: string[] = [];
    if (coreStr) parts.push(`【この人のプロフィール】\n${coreStr}`);
    if (episodesStr) parts.push(`【最近のできごと】\n${episodesStr}`);

    if (parts.length === 0) return '';
    return '\n\n' + parts.join('\n\n') + '\n↑この情報を参考にして、文脈に合うものがあれば自然に活かしてください。ただし無理に使わなくてよいです。';
};
