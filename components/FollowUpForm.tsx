import React, { useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import type { FollowUpQuestion } from '../services/gemini';

interface Props {
    questions: FollowUpQuestion[];
    onSubmit: (answers: { question: string; answer: string }[]) => void;
    onSkip: () => void;
    isLoading: boolean;
}

export function FollowUpForm({ questions, onSubmit, onSkip, isLoading }: Props) {
    const [answers, setAnswers] = useState<{ [idx: number]: string }>(
        () => Object.fromEntries(questions.map((_, i) => [i, '']))
    );
    const [customInputs, setCustomInputs] = useState<{ [idx: number]: boolean }>(
        () => Object.fromEntries(questions.map((_, i) => [i, false]))
    );

    const selectChoice = (idx: number, choice: string) => {
        setCustomInputs((prev) => ({ ...prev, [idx]: false }));
        setAnswers((prev) => ({ ...prev, [idx]: choice }));
    };

    const setCustomText = (idx: number, text: string) => {
        setAnswers((prev) => ({ ...prev, [idx]: text }));
    };

    const enableCustom = (idx: number) => {
        setCustomInputs((prev) => ({ ...prev, [idx]: true }));
        setAnswers((prev) => ({ ...prev, [idx]: '' }));
    };

    const handleSubmit = () => {
        const result = questions.map((q, i) => ({
            question: q.question,
            answer: answers[i] || '',
        }));
        onSubmit(result);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerEmoji}>🤔</Text>
                <Text style={styles.headerTitle}>もう少し教えて！</Text>
                <Text style={styles.headerSub}>回答すると日記がより具体的になります</Text>
            </View>

            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
                {questions.map((q, idx) => (
                    <View key={idx} style={styles.questionCard}>
                        <Text style={styles.questionText}>{q.question}</Text>

                        <View style={styles.choicesRow}>
                            {q.choices.map((choice, cidx) => (
                                <TouchableOpacity
                                    key={cidx}
                                    style={[
                                        styles.choiceChip,
                                        !customInputs[idx] && answers[idx] === choice && styles.choiceChipActive,
                                    ]}
                                    onPress={() => selectChoice(idx, choice)}
                                    activeOpacity={0.7}
                                >
                                    <Text
                                        style={[
                                            styles.choiceText,
                                            !customInputs[idx] && answers[idx] === choice && styles.choiceTextActive,
                                        ]}
                                    >
                                        {choice}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {customInputs[idx] ? (
                            <TextInput
                                style={styles.customInput}
                                placeholder="自由に入力..."
                                placeholderTextColor="#B0B0C0"
                                value={answers[idx]}
                                onChangeText={(t) => setCustomText(idx, t)}
                                autoFocus
                            />
                        ) : (
                            <TouchableOpacity onPress={() => enableCustom(idx)} style={styles.customBtn}>
                                <Text style={styles.customBtnText}>✏️ 自分で入力する</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
            </ScrollView>

            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={isLoading}
                    activeOpacity={0.8}
                >
                    {isLoading ? (
                        <View style={styles.row}>
                            <ActivityIndicator color="#fff" size="small" />
                            <Text style={styles.submitBtnText}>  日記を生成中...</Text>
                        </View>
                    ) : (
                        <Text style={styles.submitBtnText}>この内容で日記にする</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity onPress={onSkip} style={styles.skipBtn} disabled={isLoading}>
                    <Text style={styles.skipBtnText}>スキップしてそのまま保存</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5FA',
    },
    header: {
        alignItems: 'center',
        paddingTop: 20,
        paddingBottom: 12,
    },
    headerEmoji: {
        fontSize: 32,
        marginBottom: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1A1A2E',
    },
    headerSub: {
        fontSize: 13,
        color: '#8888A0',
        marginTop: 4,
    },
    scrollArea: {
        flex: 1,
        paddingHorizontal: 20,
    },
    questionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    questionText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1A1A2E',
        marginBottom: 12,
        lineHeight: 22,
    },
    choicesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
    },
    choiceChip: {
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 20,
        backgroundColor: '#F0EEFF',
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    choiceChipActive: {
        backgroundColor: '#6C63FF',
        borderColor: '#6C63FF',
    },
    choiceText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6C63FF',
    },
    choiceTextActive: {
        color: '#FFFFFF',
    },
    customBtn: {
        paddingVertical: 8,
    },
    customBtnText: {
        fontSize: 13,
        color: '#8888A0',
        fontWeight: '600',
    },
    customInput: {
        borderWidth: 1,
        borderColor: '#E0E0EA',
        borderRadius: 10,
        padding: 12,
        fontSize: 14,
        color: '#2D2D3A',
        backgroundColor: '#FAFAFF',
    },
    actions: {
        padding: 20,
        paddingBottom: 8,
        borderTopWidth: 1,
        borderTopColor: '#EBEBF0',
        backgroundColor: '#FAFAFF',
    },
    submitBtn: {
        backgroundColor: '#6C63FF',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 4,
    },
    submitBtnDisabled: {
        backgroundColor: '#A9A4F7',
    },
    submitBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    skipBtn: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    skipBtnText: {
        color: '#8888A0',
        fontSize: 14,
        fontWeight: '600',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});
