import { GoogleGenerativeAI } from '@google/generative-ai';

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

    const prompt = `以下のメモを読んで、日記をより具体的にするための深掘り質問を生成してください。

重要なルール：
- メモが抽象的・短い場合（例：「カレー食べた」）→ 質問を4〜5個生成して深掘りする
- メモがそこそこ具体的な場合 → 質問を2〜3個にする
- メモがすでに十分詳しい場合 → 質問は0〜1個でよい（空配列[]でもOK）
- メモの内容から自然に膨らませられるポイント（場所、感想、誰と、どうだった等）を質問にする

各質問には選択肢を3〜4つ付けてください。選択肢は短く自然なものにしてください。

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
        return parsed.slice(0, 5); // 最大5問
    } catch (error) {
        console.error('Follow-up generation error:', error);
        return []; // 質問生成に失敗したらスキップ可能にする
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
