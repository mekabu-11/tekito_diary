import { useRouter } from 'expo-router';
import { BookOpen } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { ToneSelector } from '../components/ToneSelector';
import { formatDiaryText } from '../services/gemini';
import { saveDiary, Tone } from '../services/storage';

export default function Home() {
    const router = useRouter();
    const [text, setText] = useState('');
    const [tone, setTone] = useState<Tone>('fact');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        if (!text.trim()) {
            Alert.alert('エラー', '今日あったことを入力してください');
            return;
        }

        setIsLoading(true);
        try {
            const formatted = await formatDiaryText(text, tone);

            const newDiary = {
                id: Date.now().toString(),
                date: new Date().toLocaleDateString('ja-JP'),
                originalText: text,
                formattedText: formatted,
                tone,
                timestamp: Date.now(),
            };

            await saveDiary(newDiary);
            setText(''); // 成功したらクリア

            Alert.alert('成功', '日記を保存しました！', [
                { text: '履歴を見る', onPress: () => router.push('/history') },
                { text: '閉じる', style: 'cancel' }
            ]);
        } catch (error: any) {
            Alert.alert('エラー', '日記の生成に失敗しました。\n' + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
            <View style={styles.form}>
                <Text style={styles.prompt}>
                    今日あったことを適当に書いてください。
                </Text>
                <TextInput
                    style={styles.input}
                    placeholder="例：今日は雨だったけど、お昼のラーメンが美味しかった。帰りにスーパーでアイスを買った。"
                    multiline
                    value={text}
                    onChangeText={setText}
                    editable={!isLoading}
                    textAlignVertical="top"
                />

                <ToneSelector selectedTone={tone} onSelectTone={setTone} />

                <TouchableOpacity
                    style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={isLoading}
                    activeOpacity={0.8}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>AIで日記にする</Text>
                    )}
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={styles.historyButton}
                onPress={() => router.push('/history')}
            >
                <BookOpen size={20} color="#007AFF" />
                <Text style={styles.historyButtonText}>過去の日記を見る</Text>
            </TouchableOpacity>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    form: {
        flex: 1,
        padding: 20,
    },
    prompt: {
        fontSize: 16,
        color: '#333',
        marginBottom: 12,
    },
    input: {
        flex: 1,
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#eee',
        minHeight: 150,
    },
    submitButton: {
        backgroundColor: '#007AFF',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    submitButtonDisabled: {
        backgroundColor: '#A0CFFF',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    historyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        backgroundColor: '#fafafa',
    },
    historyButtonText: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
});
