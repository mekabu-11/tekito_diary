import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { DiaryCard } from '../components/DiaryCard';
import { Diary, getDiaries } from '../services/storage';

// 日本語ロケール設定
LocaleConfig.locales['ja'] = {
    monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    dayNames: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
    dayNamesShort: ['日', '月', '火', '水', '木', '金', '土'],
    today: '今日',
};
LocaleConfig.defaultLocale = 'ja';

type MarkedDates = {
    [date: string]: {
        marked?: boolean;
        selected?: boolean;
        selectedColor?: string;
        dotColor?: string;
    };
};

export default function History() {
    const { date: initialDate } = useLocalSearchParams<{ date?: string }>();
    const [diaries, setDiaries] = useState<Diary[]>([]);
    const [markedDates, setMarkedDates] = useState<MarkedDates>({});
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedDiary, setSelectedDiary] = useState<Diary | null>(null);
    const hasAutoSelected = useRef(false);

    useFocusEffect(
        useCallback(() => {
            hasAutoSelected.current = false;
            loadDiaries();
        }, [initialDate])
    );

    const loadDiaries = async () => {
        const data = await getDiaries();
        setDiaries(data);

        // カレンダーに日記がある日をマーク
        const marks: MarkedDates = {};
        data.forEach((d) => {
            marks[d.date] = {
                marked: true,
                dotColor: '#6C63FF',
            };
        });

        // クエリパラメータで日付指定がある場合、自動選択
        if (initialDate && !hasAutoSelected.current) {
            hasAutoSelected.current = true;
            const diary = data.find((d) => d.date === initialDate);
            setSelectedDate(initialDate);
            setSelectedDiary(diary || null);

            // 選択状態のマークを反映
            data.forEach((d) => {
                marks[d.date] = {
                    marked: true,
                    dotColor: d.date === initialDate ? '#fff' : '#6C63FF',
                    selected: d.date === initialDate,
                    selectedColor: '#6C63FF',
                };
            });
            if (!marks[initialDate]) {
                marks[initialDate] = { selected: true, selectedColor: '#D4D4E8' };
            }
        }

        setMarkedDates(marks);
    };

    const handleDayPress = (day: { dateString: string }) => {
        const dateStr = day.dateString;
        setSelectedDate(dateStr);

        const diary = diaries.find((d) => d.date === dateStr);
        setSelectedDiary(diary || null);

        // 選択状態のマークを更新
        const updatedMarks: MarkedDates = {};
        diaries.forEach((d) => {
            updatedMarks[d.date] = {
                marked: true,
                dotColor: d.date === dateStr ? '#fff' : '#6C63FF',
                selected: d.date === dateStr,
                selectedColor: '#6C63FF',
            };
        });

        // 日記がない日の選択
        if (!updatedMarks[dateStr]) {
            updatedMarks[dateStr] = {
                selected: true,
                selectedColor: '#D4D4E8',
            };
        }

        setMarkedDates(updatedMarks);
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Calendar */}
            <View style={styles.calendarCard}>
                <Calendar
                    onDayPress={handleDayPress}
                    markedDates={markedDates}
                    theme={{
                        backgroundColor: '#FFFFFF',
                        calendarBackground: '#FFFFFF',
                        textSectionTitleColor: '#8888A0',
                        selectedDayBackgroundColor: '#6C63FF',
                        selectedDayTextColor: '#FFFFFF',
                        todayTextColor: '#6C63FF',
                        dayTextColor: '#2D2D3A',
                        textDisabledColor: '#C8C8D4',
                        dotColor: '#6C63FF',
                        selectedDotColor: '#FFFFFF',
                        arrowColor: '#6C63FF',
                        monthTextColor: '#1A1A2E',
                        textDayFontWeight: '500',
                        textMonthFontWeight: '700',
                        textDayHeaderFontWeight: '600',
                        textDayFontSize: 15,
                        textMonthFontSize: 17,
                        textDayHeaderFontSize: 13,
                    }}
                    style={styles.calendar}
                />
            </View>

            {/* Selected Date Content */}
            {selectedDate ? (
                <View style={styles.diarySection}>
                    {selectedDiary ? (
                        <DiaryCard diary={selectedDiary} />
                    ) : (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyEmoji}>📝</Text>
                            <Text style={styles.emptyText}>この日の日記はありません</Text>
                        </View>
                    )}
                </View>
            ) : (
                <View style={styles.hintContainer}>
                    <Text style={styles.hintEmoji}>👆</Text>
                    <Text style={styles.hintText}>日付をタップして日記を表示</Text>
                    <Text style={styles.hintSubText}>紫のドットがある日に日記があります</Text>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5FA',
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    calendarCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
        marginBottom: 20,
    },
    calendar: {
        borderRadius: 20,
        paddingBottom: 10,
    },
    diarySection: {
        marginTop: 4,
    },
    emptyCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    emptyEmoji: {
        fontSize: 32,
        marginBottom: 12,
    },
    emptyText: {
        fontSize: 15,
        color: '#8888A0',
        fontWeight: '600',
    },
    hintContainer: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    hintEmoji: {
        fontSize: 28,
        marginBottom: 10,
    },
    hintText: {
        fontSize: 15,
        color: '#8888A0',
        fontWeight: '600',
    },
    hintSubText: {
        fontSize: 13,
        color: '#B0B0C0',
        marginTop: 6,
    },
});
