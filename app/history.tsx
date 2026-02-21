import { useFocusEffect } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { DiaryCard } from '../components/DiaryCard';
import { Diary, getDiaries } from '../services/storage';

export default function History() {
    const [diaries, setDiaries] = useState<Diary[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useFocusEffect(
        React.useCallback(() => {
            loadDiaries();
        }, [])
    );

    const loadDiaries = async () => {
        setIsLoading(true);
        const data = await getDiaries();
        setDiaries(data);
        setIsLoading(false);
    };

    if (isLoading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    if (diaries.length === 0) {
        return (
            <View style={styles.center}>
                <Text style={styles.emptyText}>まだ日記がありません。{'\n'}今日の出来事を書いてみましょう！</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={diaries}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <DiaryCard diary={item} />}
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    listContent: {
        padding: 16,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    emptyText: {
        fontSize: 16,
        color: '#888',
        textAlign: 'center',
        lineHeight: 24,
    },
});
