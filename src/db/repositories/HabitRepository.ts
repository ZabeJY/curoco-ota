/**
 * Curoco — Habit Repository
 * Daily habit check-in tracking
 */

import { getDatabase } from '../index';
import { v4 as uuidv4 } from 'uuid';

function generateId(): string {
  try { return uuidv4(); } catch { return 'h-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
}

export interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface HabitRecord {
  id: string;
  habit_id: string;
  date: string; // YYYY-MM-DD
  created_at: string;
}

export interface HabitWithStreak extends Habit {
  checkInCount: number; // check-ins today
  streak: number; // consecutive days including today
  totalDays: number;
}

export const HabitRepository = {
  async getAll(): Promise<Habit[]> {
    const db = await getDatabase();
    return db.getAllAsync<Habit>('SELECT * FROM habits ORDER BY sort_order, created_at');
  },

  async create(name: string, icon: string = '✅', color: string = '#6C63FF'): Promise<Habit> {
    const db = await getDatabase();
    const id = generateId();
    const now = new Date().toISOString();
    // Get max sort_order
    const row = await db.getFirstAsync<{ m: number }>('SELECT COALESCE(MAX(sort_order), 0) as m FROM habits');
    const sortOrder = (row?.m ?? 0) + 1;
    await db.runAsync(
      'INSERT INTO habits (id, name, icon, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, icon, color, sortOrder, now]
    );
    return { id, name, icon, color, sort_order: sortOrder, created_at: now };
  },

  async update(id: string, updates: Partial<Pick<Habit, 'name' | 'icon' | 'color'>>): Promise<void> {
    const db = await getDatabase();
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon); }
    if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color); }
    if (fields.length === 0) return;
    values.push(id);
    await db.runAsync(`UPDATE habits SET ${fields.join(', ')} WHERE id = ?`, values);
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM habit_records WHERE habit_id = ?', [id]);
    await db.runAsync('DELETE FROM habits WHERE id = ?', [id]);
  },

  async checkIn(habitId: string, date: string): Promise<boolean> {
    const db = await getDatabase();
    const id = generateId();
    await db.runAsync(
      'INSERT INTO habit_records (id, habit_id, date, created_at) VALUES (?, ?, ?, ?)',
      [id, habitId, date, new Date().toISOString()]
    );
    return true;
  },

  async uncheckIn(habitId: string, date: string): Promise<void> {
    const db = await getDatabase();
    // Remove one record for this habit on this date (most recent first)
    await db.runAsync(
      'DELETE FROM habit_records WHERE id = (SELECT id FROM habit_records WHERE habit_id = ? AND date = ? ORDER BY created_at DESC LIMIT 1)',
      [habitId, date]
    );
  },

  async isCheckedIn(habitId: string, date: string): Promise<boolean> {
    const db = await getDatabase();
    const row = await db.getFirstAsync('SELECT 1 FROM habit_records WHERE habit_id = ? AND date = ?', [habitId, date]);
    return !!row;
  },

  async getCheckInCount(habitId: string, date: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) as c FROM habit_records WHERE habit_id = ? AND date = ?',
      [habitId, date]
    );
    return row?.c ?? 0;
  },

  async getRecordsForMonth(habitId: string, yearMonth: string): Promise<string[]> {
    // yearMonth = "2026-06", returns ["2026-06-01", "2026-06-05", ...]
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ date: string }>(
      'SELECT date FROM habit_records WHERE habit_id = ? AND date LIKE ? ORDER BY date',
      [habitId, `${yearMonth}%`]
    );
    return rows.map(r => r.date);
  },

  async getStreak(habitId: string): Promise<number> {
    // Count consecutive days ending today
    const db = await getDatabase();
    const today = new Date();
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const row = await db.getFirstAsync('SELECT 1 FROM habit_records WHERE habit_id = ? AND date = ?', [habitId, dateStr]);
      if (row) streak++;
      else break;
    }
    return streak;
  },

  async getTotalDays(habitId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) as c FROM habit_records WHERE habit_id = ?', [habitId]
    );
    return row?.c ?? 0;
  },

  async getAllWithStreak(): Promise<HabitWithStreak[]> {
    const habits = await this.getAll();
    const today = new Date().toISOString().slice(0, 10);
    const results: HabitWithStreak[] = [];
    for (const h of habits) {
      const checkInCount = await this.getCheckInCount(h.id, today);
      const streak = await this.getStreak(h.id);
      const totalDays = await this.getTotalDays(h.id);
      results.push({ ...h, checkInCount, streak, totalDays });
    }
    return results;
  },
};
