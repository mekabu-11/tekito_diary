import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { setupDailyReminder } from '../services/notification';

export default function RootLayout() {
    useEffect(() => {
        setupDailyReminder();
    }, []);

    return (
        <>
            <StatusBar style="dark" />
            <Stack
                screenOptions={{
                    headerStyle: {
                        backgroundColor: '#FAFAFF',
                    },
                    headerTitleStyle: {
                        fontWeight: '700',
                        fontSize: 17,
                        color: '#1A1A2E',
                    },
                    headerShadowVisible: false,
                    headerTintColor: '#6C63FF',
                    contentStyle: {
                        backgroundColor: '#F5F5FA',
                    },
                }}
            >
                <Stack.Screen
                    name="index"
                    options={{
                        title: 'てきとー日記',
                    }}
                />
                <Stack.Screen
                    name="history"
                    options={{
                        title: '日記カレンダー',
                        presentation: 'card',
                    }}
                />
            </Stack>
        </>
    );
}
