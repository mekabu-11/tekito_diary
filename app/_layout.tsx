import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { setupDailyReminder } from '../services/notification';

export default function RootLayout() {
    useEffect(() => {
        setupDailyReminder();
    }, []);

    return (
        <Stack>
            <Stack.Screen
                name="index"
                options={{
                    title: 'てきとー日記',
                    headerLargeTitle: true,
                }}
            />
            <Stack.Screen
                name="history"
                options={{
                    title: '過去の日記',
                    presentation: 'card',
                }}
            />
        </Stack>
    );
}
