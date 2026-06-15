/**
 * Curoco — Custom Sticker Repository
 * CRUD for user-imported emoji/sticker packs with AI understanding
 */

import { getDatabase } from '../index';
import { v4 as uuidv4 } from 'uuid';

export interface CustomSticker {
  id: string;
  file_path: string;
  thumbnail_path: string;
  mime_type: string;
  is_animated: boolean;
  meaning: string;
  hash: string;
  tags: string[];
  added_at: string;
}

function genId(): string {
  try { return uuidv4(); } catch { return 'st-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
}
function now(): string { return new Date().toISOString(); }

export const StickerRepository = {
  async getAll(): Promise<CustomSticker[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>('SELECT * FROM custom_stickers ORDER BY added_at DESC');
    return rows.map(rowToSticker);
  },

  async getById(id: string): Promise<CustomSticker | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>('SELECT * FROM custom_stickers WHERE id = ?', [id]);
    return row ? rowToSticker(row) : null;
  },

  async getByHash(hash: string): Promise<CustomSticker | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>('SELECT * FROM custom_stickers WHERE hash = ?', [hash]);
    return row ? rowToSticker(row) : null;
  },

  async search(query: string): Promise<CustomSticker[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM custom_stickers WHERE meaning LIKE ? OR tags LIKE ? ORDER BY added_at DESC`,
      [`%${query}%`, `%${query}%`]
    );
    return rows.map(rowToSticker);
  },

  async create(data: {
    file_path: string;
    thumbnail_path: string;
    mime_type: string;
    is_animated: boolean;
    meaning: string;
    hash: string;
    tags?: string[];
  }): Promise<CustomSticker> {
    const db = await getDatabase();
    const id = genId();
    const ts = now();
    await db.runAsync(
      `INSERT INTO custom_stickers (id, file_path, thumbnail_path, mime_type, is_animated, meaning, hash, tags, added_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.file_path, data.thumbnail_path, data.mime_type, data.is_animated ? 1 : 0,
       data.meaning, data.hash, JSON.stringify(data.tags || []), ts]
    );
    return { id, ...data, tags: data.tags || [], added_at: ts };
  },

  async updateMeaning(id: string, meaning: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE custom_stickers SET meaning = ? WHERE id = ?', [meaning, id]);
  },

  async updateTags(id: string, tags: string[]): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE custom_stickers SET tags = ? WHERE id = ?', [JSON.stringify(tags), id]);
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM custom_stickers WHERE id = ?', [id]);
  },

  async deleteAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM custom_stickers');
  },

  async count(): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM custom_stickers');
    return row?.cnt ?? 0;
  },

  /**
   * Find stickers matching a semantic query (for AI to pick stickers)
   */
  async findByMeaning(keywords: string[]): Promise<CustomSticker[]> {
    const db = await getDatabase();
    const conditions = keywords.map(() => 'meaning LIKE ?').join(' OR ');
    const params = keywords.map((k) => `%${k}%`);
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM custom_stickers WHERE ${conditions} LIMIT 5`,
      params
    );
    return rows.map(rowToSticker);
  },
};

function rowToSticker(r: any): CustomSticker {
  return {
    id: r.id,
    file_path: r.file_path,
    thumbnail_path: r.thumbnail_path,
    mime_type: r.mime_type,
    is_animated: r.is_animated === 1,
    meaning: r.meaning || '',
    hash: r.hash,
    tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags || []),
    added_at: r.added_at,
  };
}
