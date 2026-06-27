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
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = `${yearMonth}-01`;
    const endMonth = month === 12 ? `${year + 1}-01` : `${yearMonth.slice(0, 7)}-${String(month + 1).padStart(2, '0')}`;
    const rows = await db.getAllAsync<{ date: string }>(
      'SELECT date FROM habit_records WHERE habit_id = ? AND date >= ? AND date < ? ORDER BY date',
      [habitId, startDate, endMonth]
    );
    return rows.map(r => r.date);
  },

  async getStreak(habitId: string): Promise<number> {
    // Single query: fetch all dates in reverse order, compute streak in JS
    const db = await getDatabase();
    const today = new Date().toISOString().slice(0, 10);
    const rows = await db.getAllAsync<{ date: string }>(
      'SELECT DISTINCT date FROM habit_records WHERE habit_id = ? AND date <= ? ORDER BY date DESC LIMIT 365',
      [habitId, today]
    );
    if (rows.length === 0) return 0;
    let streak = 0;
    let expectedDate = today;
    for (const row of rows) {
      if (row.date === expectedDate) {
        streak++;
        // Move expected date to previous day
        const d = new Date(expectedDate);
        d.setDate(d.getDate() - 1);
        expectedDate = d.toISOString().slice(0, 10);
      } else {
        break;
      }
    }
    return streak;
  },

  async getTotalDays(habitId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ c: number }>(
      'SELECT COUNT(DISTINCT date) as c FROM habit_records WHERE habit_id = ?', [habitId]
    );
    return row?.c ?? 0;
  },

  async getAllWithStreak(): Promise<HabitWithStreak[]> {
    const habits = await this.getAll();
    if (habits.length === 0) return [];
    const today = new Date().toISOString().slice(0, 10);

    // Batch query: get all records for all habits in one query
    const db = await getDatabase();
    const habitIds = habits.map(h => `'${h.id}'`).join(',');
    const allRecords = await db.getAllAsync<{ habit_id: string; date: string }>(
      `SELECT habit_id, date FROM habit_records WHERE habit_id IN (${habitIds}) ORDER BY date DESC`
    );

    // Group records by habit
    const recordsByHabit = new Map<string, string[]>();
    for (const r of allRecords) {
      if (!recordsByHabit.has(r.habit_id)) recordsByHabit.set(r.habit_id, []);
      recordsByHabit.get(r.habit_id)!.push(r.date);
    }

    // Get today's counts
    const todayCounts = await db.getAllAsync<{ habit_id: string; c: number }>(
      `SELECT habit_id, COUNT(*) as c FROM habit_records WHERE habit_id IN (${habitIds}) AND date = ? GROUP BY habit_id`,
      [today]
    );
    const countMap = new Map(todayCounts.map(r => [r.habit_id, r.c]));

    const results: HabitWithStreak[] = [];
    for (const h of habits) {
      const dates = recordsByHabit.get(h.id) || [];
      const checkInCount = countMap.get(h.id) || 0;

      // Compute streak from sorted dates (descending)
      let streak = 0;
      let expectedDate = today;
      for (const date of dates) {
        if (date === expectedDate) {
          streak++;
          const d = new Date(expectedDate);
          d.setDate(d.getDate() - 1);
          expectedDate = d.toISOString().slice(0, 10);
        } else if (date < expectedDate) {
          break;
        }
      }

      // Count unique days
      const uniqueDays = new Set(dates).size;

      results.push({ ...h, checkInCount, streak, totalDays: uniqueDays });
    }
    return results;
  },
};
