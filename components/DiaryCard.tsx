import { FileText, Sparkles } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Diary } from '../services/storage';

interface Props {
    diary: Diary;
}

export function DiaryCard({ diary }: Props) {
    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.date}>{diary.date}</Text>
                <View style={styles.toneBadge}>
                    {diary.tone === 'fact' ? (
                        <FileText size={16} color="#007AFF" />
                    ) : (
                        <Sparkles size={16} color="#FF2D55" />
                    )}
                    <Text style={[styles.toneText, diary.tone === 'fact' ? styles.factText : styles.genzText]}>
                        {diary.tone === 'fact' ? ' 事実' : ' Z世代'}
                    </Text>
                </View>
            </View>
            <Text style={styles.formattedText}>{diary.formattedText}</Text>
            <View style={styles.originalContainer}>
                <Text style={styles.originalLabel}>元のメモ：</Text>
                <Text style={styles.originalText} numberOfLines={2}>{diary.originalText}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    date: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
    },
    toneBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8f8f8',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    toneText: {
        fontSize: 12,
        fontWeight: '600',
    },
    factText: {
        color: '#007AFF',
    },
    genzText: {
        color: '#FF2D55',
    },
    formattedText: {
        fontSize: 15,
        lineHeight: 24,
        color: '#222',
    },
    originalContainer: {
        marginTop: 16,
        backgroundColor: '#f6f6f6',
        padding: 12,
        borderRadius: 8,
    },
    originalLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#888',
        marginBottom: 4,
    },
    originalText: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
});
