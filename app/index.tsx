import { useRouter } from 'expo-router';
import { CalendarDays, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FollowUpForm } from '../components/FollowUpForm';
import { FollowUpQuestion, formatDiaryText, generateFollowUpQuestions } from '../services/gemini';
import { getDiaryByDate, saveDiary, updateDiary } from '../services/storage';

const toDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const toDisplayDate = (d: Date) =>
    d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

const toDateLabel = (d: Date) => {
    const today = new Date();
    const todayKey = toDateKey(today);
    const targetKey = toDateKey(d);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (targetKey === todayKey) return '今日';
    if (targetKey === toDateKey(yesterday)) return '昨日';
    return `${d.getMonth() + 1}/${d.getDate()}`;
};

export default function Home() {
    const router = useRouter();
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    // 深掘り質問の状態
    const [showFollowUp, setShowFollowUp] = useState(false);
    const [followUpQuestions, setFollowUpQuestions] = useState<FollowUpQuestion[]>([]);
    const [pendingText, setPendingText] = useState('');
    const [pendingDateKey, setPendingDateKey] = useState('');
    const [pendingExisting, setPendingExisting] = useState<Awaited<ReturnType<typeof getDiaryByDate>>>(undefined);
    const [pendingMode, setPendingMode] = useState<'merge' | 'replace' | 'new'>('new');
    const [isGeneratingFinal, setIsGeneratingFinal] = useState(false);

    const dateKey = toDateKey(selectedDate);
    const displayDate = toDisplayDate(selectedDate);
    const dateLabel = toDateLabel(selectedDate);

    const shiftDate = (days: number) => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + days);
        setSelectedDate(newDate);
    };

    const handleSubmit = async () => {
        if (!text.trim()) {
            Alert.alert('入力してください', '今日あったことを書いてから変換しましょう');
            return;
        }

        const existing = await getDiaryByDate(dateKey);

        if (existing) {
            Alert.alert('この日の日記がすでにあります', 'どうしますか？', [
                { text: '追記（マージ）', onPress: () => startFollowUp(text, dateKey, existing, 'merge') },
                { text: '上書き（削除して新規）', style: 'destructive', onPress: () => startFollowUp(text, dateKey, existing, 'replace') },
                { text: 'キャンセル', style: 'cancel' },
            ]);
        } else {
            await startFollowUp(text, dateKey, undefined, 'new');
        }
    };

    // Step 1: 深掘り質問を生成してモーダルを開く
    const startFollowUp = async (
        inputText: string,
        targetDateKey: string,
        existing: Awaited<ReturnType<typeof getDiaryByDate>>,
        mode: 'merge' | 'replace' | 'new'
    ) => {
        setPendingText(inputText);
        setPendingDateKey(targetDateKey);
        setPendingExisting(existing);
        setPendingMode(mode);

        setIsLoading(true);
        try {
            const questions = await generateFollowUpQuestions(inputText);
            if (questions.length > 0) {
                setFollowUpQuestions(questions);
                setShowFollowUp(true);
            } else {
                // 質問生成できなかった → そのまま保存
                await finalizeDiary(inputText, targetDateKey, existing, mode);
            }
        } catch {
            await finalizeDiary(inputText, targetDateKey, existing, mode);
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2: 質問回答付きで最終日記を生成
    const handleFollowUpSubmit = async (answers: { question: string; answer: string }[]) => {
        setIsGeneratingFinal(true);
        try {
            await finalizeDiary(pendingText, pendingDateKey, pendingExisting, pendingMode, answers);
            setShowFollowUp(false);
        } catch (error: any) {
            Alert.alert('エラー', error.message);
        } finally {
            setIsGeneratingFinal(false);
        }
    };

    // スキップ → 回答なしで保存
    const handleFollowUpSkip = async () => {
        setIsGeneratingFinal(true);
        try {
            await finalizeDiary(pendingText, pendingDateKey, pendingExisting, pendingMode);
            setShowFollowUp(false);
        } catch (error: any) {
            Alert.alert('エラー', error.message);
        } finally {
            setIsGeneratingFinal(false);
        }
    };

    // 最終日記生成＆保存
    const finalizeDiary = async (
        inputText: string,
        targetDateKey: string,
        existing: Awaited<ReturnType<typeof getDiaryByDate>>,
        mode: 'merge' | 'replace' | 'new',
        answers?: { question: string; answer: string }[]
    ) => {
        const now = new Date();
        const currentTime = `${now.getHours()}時${now.getMinutes()}分`;

        let formatted: string;
        let originalText: string;
        let id: string;

        if (mode === 'merge' && existing) {
            formatted = await formatDiaryText(inputText, currentTime, answers, existing.originalText);
            originalText = existing.originalText + '\n' + inputText;
            id = existing.id;
        } else {
            formatted = await formatDiaryText(inputText, currentTime, answers);
            originalText = inputText;
            id = mode === 'replace' && existing ? existing.id : Date.now().toString();
        }

        const diary = {
            id,
            date: targetDateKey,
            displayDate: toDisplayDate(selectedDate),
            originalText,
            formattedText: formatted,
            timestamp: Date.now(),
        };

        if (existing) {
            await updateDiary(diary);
        } else {
            await saveDiary(diary);
        }
        setText('');

        // 保存後、その日付の日記に自動遷移
        router.push(`/history?date=${targetDateKey}`);
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <ScrollView
                    style={styles.flex}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Date Selector */}
                    <View style={styles.dateSelector}>
                        <TouchableOpacity onPress={() => shiftDate(-1)} style={styles.dateArrow}>
                            <ChevronLeft size={22} color="#6C63FF" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setSelectedDate(new Date())} style={styles.dateCenterBtn}>
                            <Text style={styles.dateLabelText}>{dateLabel}</Text>
                            <Text style={styles.dateFullText}>{displayDate}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => shiftDate(1)} style={styles.dateArrow}>
                            <ChevronRight size={22} color="#6C63FF" />
                        </TouchableOpacity>
                    </View>

                    {/* Input Area */}
                    <View style={styles.inputCard}>
                        <TextInput
                            style={styles.input}
                            placeholder={'例：朝カフェでモーニング食べた\n昼は会議が3つもあってしんどかった\n帰りにコンビニでアイス買った'}
                            placeholderTextColor="#B0B0C0"
                            multiline
                            value={text}
                            onChangeText={setText}
                            editable={!isLoading}
                            textAlignVertical="top"
                        />
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                        style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={isLoading}
                        activeOpacity={0.8}
                    >
                        {isLoading ? (
                            <View style={styles.buttonRow}>
                                <ActivityIndicator color="#fff" size="small" />
                                <Text style={styles.submitButtonText}>  質問を生成中...</Text>
                            </View>
                        ) : (
                            <View style={styles.buttonRow}>
                                <Sparkles size={18} color="#fff" />
                                <Text style={styles.submitButtonText}>  AIで日記にする</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </ScrollView>

                {/* Bottom Bar */}
                <View style={styles.bottomBar}>
                    <TouchableOpacity
                        style={styles.historyButton}
                        onPress={() => router.push('/history')}
                        activeOpacity={0.7}
                    >
                        <CalendarDays size={20} color="#6C63FF" />
                        <Text style={styles.historyButtonText}>カレンダーで日記を見る</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* 深掘り質問モーダル */}
            <Modal visible={showFollowUp} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={styles.flex}>
                    <FollowUpForm
                        questions={followUpQuestions}
                        onSubmit={handleFollowUpSubmit}
                        onSkip={handleFollowUpSkip}
                        isLoading={isGeneratingFinal}
                    />
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5FA' },
    flex: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 8 },
    dateSelector: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    },
    dateArrow: { padding: 8, borderRadius: 10, backgroundColor: '#F0EEFF' },
    dateCenterBtn: { flex: 1, alignItems: 'center', paddingVertical: 4 },
    dateLabelText: { fontSize: 20, fontWeight: '800', color: '#1A1A2E', letterSpacing: -0.3 },
    dateFullText: { fontSize: 13, color: '#8888A0', marginTop: 2 },
    inputCard: {
        backgroundColor: '#FFFFFF', borderRadius: 20, padding: 4,
        shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 3, marginBottom: 16,
    },
    input: { minHeight: 180, padding: 16, fontSize: 16, lineHeight: 26, color: '#2D2D3A', borderRadius: 16 },
    submitButton: {
        backgroundColor: '#6C63FF', paddingVertical: 18, borderRadius: 16, alignItems: 'center',
        shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 5,
    },
    submitButtonDisabled: { backgroundColor: '#A9A4F7', shadowOpacity: 0.1 },
    submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
    buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    bottomBar: { paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#EBEBF0', backgroundColor: '#FAFAFF' },
    historyButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 12, backgroundColor: '#EEEDFF', borderRadius: 14,
    },
    historyButtonText: { color: '#6C63FF', fontSize: 15, fontWeight: '700', marginLeft: 8, letterSpacing: 0.2 },
});
