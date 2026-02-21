import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Tone } from './storage';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

export const formatDiaryText = async (originalText: string, tone: Tone): Promise<string> => {
    if (!API_KEY || API_KEY === 'your_api_key_here') {
        throw new Error('API key is not set. Please check your .env file.');
    }

    let prompt = '';
    if (tone === 'fact') {
        prompt = `以下の「今日あったこと」のメモを、事実だけを淡々と抽出した、読みやすくて綺麗な文章の日記に整形してください。\n\nメモ：\n${originalText}`;
    } else {
        prompt = `以下の「今日あったこと」のメモを、Z世代の若者っぽく、絵文字も少し使ったフランクな言葉遣いで要約した日記に整形してください。\n\nメモ：\n${originalText}`;
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
