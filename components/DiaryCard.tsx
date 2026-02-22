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
                <Text style={styles.date}>{diary.displayDate}</Text>
            </View>
            <Text style={styles.formattedText}>{diary.formattedText}</Text>
            <View style={styles.originalContainer}>
                <Text style={styles.originalLabel}>元のメモ</Text>
                <Text style={styles.originalText}>{diary.originalText}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
    },
    header: {
        marginBottom: 14,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F5',
    },
    date: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1A1A2E',
        letterSpacing: 0.3,
    },
    formattedText: {
        fontSize: 15,
        lineHeight: 26,
        color: '#2D2D3A',
        letterSpacing: 0.2,
    },
    originalContainer: {
        marginTop: 18,
        backgroundColor: '#F7F7FB',
        padding: 14,
        borderRadius: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#D4D4E8',
    },
    originalLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#9595A8',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 6,
    },
    originalText: {
        fontSize: 13,
        color: '#6E6E82',
        lineHeight: 20,
    },
});
