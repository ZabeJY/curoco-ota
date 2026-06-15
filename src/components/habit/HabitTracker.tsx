/**
 * Curoco — Habit Tracker
 * Daily check-in with mini calendar and streak display
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HabitRepository, type HabitWithStreak } from '../../db/repositories/HabitRepository';
import type { Theme } from '../../theme/colors';

const COLORS = ['#6C63FF', '#FF6B6B', '#FFA94D', '#FFD43B', '#69DB7C', '#4DABF7', '#F783AC', '#9775FA'];
const ICONS = ['💧', '🏃', '📚', '🧘', '🎨', '💤', '🍎', '✍️', '🎵', '🌱', '☀️', '💪'];

interface HabitTrackerProps {
  theme: Theme;
}

export default function HabitTracker({ theme }: HabitTrackerProps) {
  const [habits, setHabits] = useState<HabitWithStreak[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('✅');
  const [newColor, setNewColor] = useState('#6C63FF');
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthRecords, setMonthRecords] = useState<Record<string, string[]>>({});

  const today = new Date().toISOString().slice(0, 10);

  const loadHabits = useCallback(async () => {
    try {
      const data = await HabitRepository.getAllWithStreak();
      setHabits(data);
      const records: Record<string, string[]> = {};
      for (const h of data) {
        records[h.id] = await HabitRepository.getRecordsForMonth(h.id, currentMonth);
      }
      setMonthRecords(records);
    } catch (e) { console.warn('Load habits:', e); }
  }, [currentMonth]);

  useEffect(() => { loadHabits(); }, [loadHabits]);

  async function handleToggle(habitId: string) {
    try {
      await HabitRepository.checkIn(habitId, today);
      await loadHabits();
    } catch (e) { console.warn('Toggle habit:', e); }
  }

  async function handleUncheck(habitId: string) {
    try {
      await HabitRepository.uncheckIn(habitId, today);
      await loadHabits();
    } catch (e) { console.warn('Uncheck habit:', e); }
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    try {
      await HabitRepository.create(name, newIcon, newColor);
      setNewName('');
      setShowAdd(false);
      await loadHabits();
    } catch (e) { console.warn('Add habit:', e); }
  }

  async function handleDelete(id: string, name: string) {
    Alert.alert('删除打卡', `确定删除「${name}」？所有记录将丢失。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: async () => {
        await HabitRepository.delete(id);
        await loadHabits();
      }},
    ]);
  }

  function getCalendarDays(): Array<{ day: number; date: string; isToday: boolean }> {
    const [y, m] = currentMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const result = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      result.push({ day: d, date: dateStr, isToday: dateStr === today });
    }
    return result;
  }

  function changeMonth(delta: number) {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const calendarDays = getCalendarDays();
  const monthLabel = (() => {
    const [y, m] = currentMonth.split('-').map(Number);
    return `${y}年${m}月`;
  })();

  if (habits.length === 0 && !showAdd) {
    return (
      <View style={[styles.emptyWrap, { backgroundColor: theme.bgCard }]}>
        <Ionicons name="checkmark-circle-outline" size={36} color={theme.textTertiary} />
        <Text style={[styles.emptyText, { color: theme.textTertiary }]}>还没有打卡项目</Text>
        <TouchableOpacity style={[styles.addFirstBtn, { backgroundColor: theme.primaryLight }]} onPress={() => setShowAdd(true)} activeOpacity={0.7}>
          <Ionicons name="add" size={16} color={theme.primary} />
          <Text style={[styles.addFirstText, { color: theme.primary }]}>创建打卡</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>生活打卡</Text>
        <TouchableOpacity onPress={() => setShowAdd(true)} activeOpacity={0.6}>
          <Ionicons name="add-circle" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Habit list */}
      {habits.map((h) => (
        <View key={h.id} style={[styles.habitRow, { backgroundColor: theme.bgSecondary }]}>
          <TouchableOpacity
            style={[styles.checkCircle, { borderColor: theme.border }, h.checkInCount > 0 && { backgroundColor: h.color, borderColor: h.color }]}
            onPress={() => handleToggle(h.id)}
            activeOpacity={0.6}
          >
            {h.checkInCount > 0 && <Ionicons name="checkmark" size={16} color="#fff" />}
          </TouchableOpacity>

          <Text style={styles.habitIcon}>{h.icon}</Text>

          <View style={styles.habitInfo}>
            <Text style={[styles.habitName, { color: theme.textPrimary }, h.checkInCount > 0 && { opacity: 0.5 }]}>{h.name}</Text>
            <Text style={[styles.habitStreak, { color: theme.textTertiary }]}>
              {h.checkInCount > 0 ? `今日 ${h.checkInCount} 次` : ''} {h.streak > 0 ? `🔥 连续${h.streak}天` : `共${h.totalDays}天`}
            </Text>
          </View>

          {/* Mini week dots */}
          <View style={styles.miniDots}>
            {calendarDays.slice(-7).map((d) => {
              const checked = monthRecords[h.id]?.includes(d.date);
              return (
                <View
                  key={d.date}
                  style={[
                    styles.miniDot,
                    { backgroundColor: checked ? h.color : theme.divider },
                    d.isToday && { borderWidth: 1, borderColor: theme.primary },
                  ]}
                />
              );
            })}
          </View>

          {h.checkInCount > 0 && (
            <TouchableOpacity onPress={() => handleUncheck(h.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="remove-circle-outline" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => handleDelete(h.id, h.name)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="ellipsis-vertical" size={14} color={theme.textTertiary} />
          </TouchableOpacity>
        </View>
      ))}

      {/* Calendar */}
      <View style={[styles.calendarCard, { backgroundColor: theme.bgSecondary }]}>
        <View style={styles.calHeader}>
          <TouchableOpacity onPress={() => changeMonth(-1)}>
            <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.calMonth, { color: theme.textPrimary }]}>{monthLabel}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)}>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          {habits.map((h) => (
            <View key={h.id} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: h.color }]} />
              <Text style={[styles.legendLabel, { color: theme.textTertiary }]} numberOfLines={1}>{h.icon}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.calGrid}>
            {calendarDays.map((d) => {
              const checkedHabits = habits.filter(h => monthRecords[h.id]?.includes(d.date));
              return (
                <View key={d.date} style={[styles.calDay, d.isToday && { borderColor: theme.primary, borderWidth: 1.5 }]}>
                  <Text style={[styles.calDayNum, { color: d.isToday ? theme.primary : theme.textTertiary }]}>{d.day}</Text>
                  <View style={styles.calDayDots}>
                    {checkedHabits.slice(0, 3).map((h) => (
                      <View key={h.id} style={[styles.calDot, { backgroundColor: h.color }]} />
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Add Modal */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.bgSecondary }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>新建打卡</Text>

            <TextInput
              style={[styles.modalInput, { color: theme.textPrimary, borderColor: theme.border, backgroundColor: theme.bgInput }]}
              value={newName}
              onChangeText={setNewName}
              placeholder="打卡名称（如：喝水、运动）"
              placeholderTextColor={theme.textTertiary}
              maxLength={20}
              autoFocus
            />

            <Text style={[styles.pickerLabel, { color: theme.textSecondary }]}>图标</Text>
            <View style={styles.iconGrid}>
              {ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[styles.iconItem, { borderColor: 'transparent' }, newIcon === icon && { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}
                  onPress={() => setNewIcon(icon)}
                >
                  <Text style={styles.iconEmoji}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.pickerLabel, { color: theme.textSecondary }]}>颜色</Text>
            <View style={styles.colorGrid}>
              {COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorItem, { backgroundColor: color }, newColor === color && styles.colorSelected]}
                  onPress={() => setNewColor(color)}
                />
              ))}
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowAdd(false)}>
                <Text style={[styles.modalCancelText, { color: theme.textTertiary }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, { backgroundColor: theme.primary, opacity: newName.trim() ? 1 : 0.4 }]}
                onPress={handleAdd}
                disabled={!newName.trim()}
              >
                <Text style={styles.modalConfirmText}>创建</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '600' },
  // Empty state
  emptyWrap: { alignItems: 'center', paddingVertical: 32, borderRadius: 20, marginBottom: 16, gap: 8 },
  emptyText: { fontSize: 13 },
  addFirstBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginTop: 4 },
  addFirstText: { fontSize: 13, fontWeight: '500' },
  // Habit row
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  checkCircle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  habitIcon: { fontSize: 20 },
  habitInfo: { flex: 1 },
  habitName: { fontSize: 15, fontWeight: '500' },
  habitStreak: { fontSize: 11, marginTop: 2 },
  miniDots: { flexDirection: 'row', gap: 3, marginRight: 4 },
  miniDot: { width: 6, height: 6, borderRadius: 3 },
  // Calendar
  calendarCard: { borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calMonth: { fontSize: 14, fontWeight: '600' },
  legendRow: { flexDirection: 'row', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11 },
  calGrid: { flexDirection: 'row', gap: 4 },
  calDay: { width: 36, alignItems: 'center', paddingVertical: 6, borderRadius: 10, gap: 4 },
  calDayNum: { fontSize: 11, fontWeight: '500' },
  calDayDots: { flexDirection: 'row', gap: 2 },
  calDot: { width: 5, height: 5, borderRadius: 2.5 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  modalCard: { width: '100%', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalInput: { fontSize: 15, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 },
  pickerLabel: { fontSize: 12, fontWeight: '500', marginBottom: 8 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  iconItem: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  iconEmoji: { fontSize: 20 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  colorItem: { width: 28, height: 28, borderRadius: 14 },
  colorSelected: { borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  modalBtns: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalCancel: { paddingHorizontal: 20, paddingVertical: 10 },
  modalCancelText: { fontSize: 15 },
  modalConfirm: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 14 },
  modalConfirmText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
