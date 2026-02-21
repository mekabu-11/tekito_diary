import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Tone } from '../services/storage';

interface Props {
    selectedTone: Tone;
    onSelectTone: (tone: Tone) => void;
}

export function ToneSelector({ selectedTone, onSelectTone }: Props) {
    return (
        <View style={styles.container}>
            <Text style={styles.label}>AIのトーンを選択</Text>
            <View style={styles.buttonGroup}>
                <TouchableOpacity
                    style={[styles.button, selectedTone === 'fact' && styles.activeButton]}
                    onPress={() => onSelectTone('fact')}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.buttonText, selectedTone === 'fact' && styles.activeButtonText]}>
                        事実（綺麗に）
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, selectedTone === 'genz' && styles.activeButton]}
                    onPress={() => onSelectTone('genz')}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.buttonText, selectedTone === 'genz' && styles.activeButtonText]}>
                        Z世代（フランク）
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#333',
    },
    buttonGroup: {
        flexDirection: 'row',
        backgroundColor: '#eee',
        borderRadius: 8,
        padding: 4,
    },
    button: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 6,
    },
    activeButton: {
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#666',
    },
    activeButtonText: {
        color: '#007AFF',
    },
});
