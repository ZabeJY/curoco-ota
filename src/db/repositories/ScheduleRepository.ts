/**
 * Curoco — Proactive Schedule Repository
 */

import { getDatabase } from '../index';
import type { ProactiveSchedule } from '../../types/models';
import { v4 as uuidv4 } from 'uuid';

function genId(): string { try { return uuidv4(); } catch { return 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); } }
function now(): string { return new Date().toISOString(); }

function rowToSchedule(r: any): ProactiveSchedule {
  return {
    id: r.id, companionId: r.companion_id, type: r.type,
    fixedTimes: r.fixed_times, randomIntervalMin: r.random_interval_min,
    randomIntervalMax: r.random_interval_max, isActive: r.is_active === 1,
    lastTriggeredAt: r.last_triggered_at, createdAt: r.created_at,
  };
}

export const ScheduleRepository = {
  async getByCompanion(companionId: string): Promise<ProactiveSchedule | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync('SELECT * FROM proactive_schedules WHERE companion_id = ?', [companionId]);
    return row ? rowToSchedule(row) : null;
  },

  async getAllActive(): Promise<ProactiveSchedule[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync('SELECT * FROM proactive_schedules WHERE is_active = 1');
    return rows.map(rowToSchedule);
  },

  async upsert(data: { companionId: string; type: 'fixed' | 'random'; fixedTimes: string[]; randomIntervalMin: number; randomIntervalMax: number; isActive: boolean }): Promise<void> {
    const db = await getDatabase();
    const existing = await this.getByCompanion(data.companionId);
    if (existing) {
      await db.runAsync(
        `UPDATE proactive_schedules SET type = ?, fixed_times = ?, random_interval_min = ?, random_interval_max = ?, is_active = ? WHERE companion_id = ?`,
        [data.type, JSON.stringify(data.fixedTimes), data.randomIntervalMin, data.randomIntervalMax, data.isActive ? 1 : 0, data.companionId]
      );
    } else {
      await db.runAsync(
        `INSERT INTO proactive_schedules (id, companion_id, type, fixed_times, random_interval_min, random_interval_max, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [genId(), data.companionId, data.type, JSON.stringify(data.fixedTimes), data.randomIntervalMin, data.randomIntervalMax, data.isActive ? 1 : 0, now()]
      );
    }
  },

  async markTriggered(companionId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE proactive_schedules SET last_triggered_at = ? WHERE companion_id = ?', [now(), companionId]);
  },
};
