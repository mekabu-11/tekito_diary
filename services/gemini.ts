import { GoogleGenerativeAI } from '@google/generative-ai';
import { addEpisodes, CoreProfile, getCoreProfile, getFullContext, saveCoreProfile } from './userProfile';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

export interface FollowUpQuestion {
    question: string;
    choices: string[];
}

/**
 * Step 1: メモから深掘り質問を生成する
 */
export const generateFollowUpQuestions = async (originalText: string): Promise<FollowUpQuestion[]> => {
    if (!API_KEY || API_KEY === 'your_api_key_here') {
        throw new Error('APIキーが未設定です。.envファイルを確認してください。');
    }

    const userContext = await getFullContext();

    const prompt = `以下のメモを読んで、日記をより具体的にするための深掘り質問を生成してください。

重要なルール：
- メモが抽象的・短い場合（例：「カレー食べた」）→ 質問を4〜5個生成して深掘りする
- メモがそこそこ具体的な場合 → 質問を2〜3個にする
- メモがすでに十分詳しい場合 → 質問は0〜1個でよい（空配列[]でもOK）
- メモの内容から自然に膨らませられるポイント（場所、感想、誰と、どうだった等）を質問にする
${userContext}

各質問には選択肢を3〜4つ付けてください。選択肢は短く自然なものにしてください。
ユーザーについて知っていることがあれば、選択肢に反映させてください（例：よく行く店名を選択肢に入れる）。

必ず以下のJSON配列形式のみで回答してください。他のテキストは含めないでください：
[
  {
    "question": "質問文",
    "choices": ["選択肢1", "選択肢2", "選択肢3"]
  }
]

質問が不要な場合は空配列を返してください：[]

メモ：
${originalText}`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return [];

        const parsed = JSON.parse(jsonMatch[0]) as FollowUpQuestion[];
        return parsed.slice(0, 5);
    } catch (error) {
        console.error('Follow-up generation error:', error);
        return [];
    }
};

/**
 * Step 2: メモ + 質問への回答から最終日記を生成する
 */
export const formatDiaryText = async (
    originalText: string,
    currentTime: string,
    answers?: { question: string; answer: string }[],
    existingText?: string,
): Promise<string> => {
    if (!API_KEY || API_KEY === 'your_api_key_here') {
        throw new Error('APIキーが未設定です。.envファイルを確認してください。');
    }

    const userContext = await getFullContext();
    const timeContext = `現在の時刻は ${currentTime} です。メモに時間帯の手がかりがない場合、この時刻を参考に「朝」「昼」「夕方」「夜」「深夜」などの時間帯を自然に推測して文章に反映してください。ただし無理に付け足さなくてよいです。`;

    let answersSection = '';
    if (answers && answers.length > 0) {
        answersSection = '\n\n【追加の詳細】\n' +
            answers
                .filter(a => a.answer.trim() !== '')
                .map(a => `Q: ${a.question}\nA: ${a.answer}`)
                .join('\n\n');
    }

    let prompt: string;

    if (existingText) {
        prompt = `以下は同じ日に複数回書かれたメモです。これらをまとめて、一つの日記として整形してください。

${timeContext}
${userContext}

ルール：
- 書かれている事実だけを淡々とまとめる
- 思ってもないことや感情を勝手に追加しない
- 誇張しない
- シンプルで読みやすい文章にする
- 時系列があれば順番通りにまとめる
- 追加の詳細があれば自然に文章に織り込む

【既存のメモ】
${existingText}

【追加のメモ】
${originalText}${answersSection}`;
    } else {
        prompt = `以下の「今日あったこと」のメモを、日記として整形してください。

${timeContext}
${userContext}

ルール：
- 書かれている事実だけを淡々とまとめる
- 思ってもないことや感情を勝手に追加しない
- 誇張しない
- シンプルで読みやすい文章にする
- 追加の詳細があれば自然に文章に織り込む

メモ：
${originalText}${answersSection}`;
    }

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Gemini API Error:', error);
        throw error;
    }
};

/**
 * Step 3: 日記から記憶を抽出して蓄積する（2バケット方式）
 * A. コアプロファイル → AIが既存プロファイルを読んで追記・修正
 * B. エピソード記憶 → 直近の出来事をFIFOで蓄積
 */
export const learnFromDiary = async (diaryText: string, originalMemo: string, dateKey: string): Promise<void> => {
    try {
        const currentProfile = await getCoreProfile();
        const currentProfileJson = JSON.stringify({
            personality: currentProfile.personality,
            people: currentProfile.people,
            places: currentProfile.places,
            work: currentProfile.work,
            lifestyle: currentProfile.lifestyle,
            preferences: currentProfile.preferences,
        });

        const prompt = `以下の日記を読んで、この人についての情報を2つのカテゴリに分けて抽出してください。

## A. コアプロファイル（永続的な情報）
この人の恒久的な属性。新しい情報があれば追加、矛盾があれば修正してください。

現在のプロファイル：
${currentProfileJson}

カテゴリ：
- personality: 性格・趣味
- people: 人間関係（名前付きで）
- places: よく行く場所・お気に入りの店
- work: 仕事・学校
- lifestyle: 生活パターン・習慣
- preferences: 好み（食べ物、音楽等）

## B. エピソード（一時的な文脈情報）
最近の出来事・状況。「最近忙しい」「風邪気味」「旅行中」等。
1〜2文で簡潔に。特になければ空配列。

必ず以下のJSON形式のみで回答してください：
{
  "profile": {
    "personality": ["項目1", "項目2"],
    "people": ["妻がいる", "友人の○○"],
    "places": ["新宿のスタバ"],
    "work": ["IT企業勤務"],
    "lifestyle": ["朝型"],
    "preferences": ["カレーが好き"]
  },
  "episodes": ["今日の出来事の要約"]
}

変更がなければ現在のプロファイルをそのまま返してください。

日記：
${diaryText}

元のメモ：
${originalMemo}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return;

        const parsed = JSON.parse(jsonMatch[0]) as {
            profile: Omit<CoreProfile, 'updatedAt'>;
            episodes: string[];
        };

        // A: コアプロファイルを上書き保存
        await saveCoreProfile({
            personality: parsed.profile.personality || [],
            people: parsed.profile.people || [],
            places: parsed.profile.places || [],
            work: parsed.profile.work || [],
            lifestyle: parsed.profile.lifestyle || [],
            preferences: parsed.profile.preferences || [],
            updatedAt: Date.now(),
        });

        // B: エピソードをFIFO追加
        if (parsed.episodes && parsed.episodes.length > 0) {
            await addEpisodes(
                parsed.episodes.map((content) => ({
                    content,
                    date: dateKey,
                    createdAt: Date.now(),
                }))
            );
        }

        console.log('Memory updated: profile + episodes');
    } catch (error) {
        console.warn('Failed to learn from diary:', error);
    }
};
