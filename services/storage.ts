import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Diary {
  id: string;
  date: string;        // YYYY-MM-DD format for calendar keys
  displayDate: string;  // 表示用 (ja-JP)
  originalText: string;
  formattedText: string;
  timestamp: number;
}

const STORAGE_KEY = '@tekito_diary_history';

export const saveDiary = async (newDiary: Diary): Promise<void> => {
  try {
    const existing = await getDiaries();
    const updated = [newDiary, ...existing];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save diary:', error);
    throw error;
  }
};

export const getDiaries = async (): Promise<Diary[]> => {
  try {
    const str = await AsyncStorage.getItem(STORAGE_KEY);
    if (!str) return [];
    return JSON.parse(str) as Diary[];
  } catch (error) {
    console.error('Failed to fetch diaries:', error);
    return [];
  }
};

export const getDiaryByDate = async (date: string): Promise<Diary | undefined> => {
  const diaries = await getDiaries();
  return diaries.find((d) => d.date === date);
};

export const updateDiary = async (updatedDiary: Diary): Promise<void> => {
  try {
    const existing = await getDiaries();
    const updated = existing.map((d) => (d.id === updatedDiary.id ? updatedDiary : d));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to update diary:', error);
    throw error;
  }
};

export const deleteDiary = async (id: string): Promise<void> => {
  try {
    const existing = await getDiaries();
    const updated = existing.filter((d) => d.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to delete diary:', error);
    throw error;
  }
};
