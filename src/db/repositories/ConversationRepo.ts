/**
 * Curoco — Conversation Repository (Fixed)
 * - Separate updateLastMessage (no unread increment) and updateLastAIMessage (with unread increment)
 * - Standardized timestamps
 */

import { getDatabase } from '../index';
import type { Conversation } from '../../types/models';
import { v4 as uuidv4 } from 'uuid';

function generateId(): string {
  try { return uuidv4(); } catch { return 'v-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
}

function now(): string { return new Date().toISOString(); }

function rowToConversation(row: any): Conversation {
  return {
    id: row.id,
    companionId: row.companion_id,
    type: row.type || 'private',
    groupName: row.group_name || null,
    lastMessagePreview: row.last_message_preview,
    lastMessageAt: row.last_message_at,
    unreadCount: row.unread_count,
    longTermMemorySummary: row.long_term_memory,
    totalMessageCount: row.total_message_count,
    createdAt: row.created_at,
  };
}

export const ConversationRepository = {
  async getAll(): Promise<Conversation[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync('SELECT * FROM conversations ORDER BY last_message_at DESC');
    return rows.map(rowToConversation);
  },

  async getById(id: string): Promise<Conversation | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync('SELECT * FROM conversations WHERE id = ?', [id]);
    return row ? rowToConversation(row) : null;
  },

  async getByCompanionId(companionId: string): Promise<Conversation | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync(
      'SELECT * FROM conversations WHERE companion_id = ?',
      [companionId]
    );
    return row ? rowToConversation(row) : null;
  },

  async create(companionId: string): Promise<Conversation> {
    const db = await getDatabase();
    const id = generateId();
    const timestamp = now();

    await db.runAsync(
      `INSERT INTO conversations (id, companion_id, last_message_at, created_at)
       VALUES (?, ?, ?, ?)`,
      [id, companionId, timestamp, timestamp]
    );

    return (await this.getById(id))!;
  },

  /** Update last message preview — for USER messages (no unread increment) */
  async updateLastMessage(id: string, preview: string): Promise<void> {
    const db = await getDatabase();
    const timestamp = now();
    await db.runAsync(
      `UPDATE conversations SET last_message_preview = ?, last_message_at = ? WHERE id = ?`,
      [preview, timestamp, id]
    );
  },

  /** Update last message preview — for AI messages (increments unread) */
  async updateLastAIMessage(id: string, preview: string): Promise<void> {
    const db = await getDatabase();
    const timestamp = now();
    await db.runAsync(
      `UPDATE conversations SET last_message_preview = ?, last_message_at = ?, unread_count = unread_count + 1 WHERE id = ?`,
      [preview, timestamp, id]
    );
  },

  async incrementMessageCount(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE conversations SET total_message_count = total_message_count + 1 WHERE id = ?',
      [id]
    );
  },

  async resetUnread(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE conversations SET unread_count = 0 WHERE id = ?', [id]);
  },

  async updateLongTermMemory(id: string, summary: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE conversations SET long_term_memory = ? WHERE id = ?', [summary, id]);
  },

  async decrementMessageCount(id: string, count: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE conversations SET total_message_count = MAX(0, total_message_count - ?) WHERE id = ?',
      [count, id]
    );
  },

  async clearMessages(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM messages WHERE conversation_id = ?', [id]);
    await db.runAsync(
      `UPDATE conversations SET last_message_preview = '', last_message_at = '', total_message_count = 0, unread_count = 0 WHERE id = ?`,
      [id]
    );
  },

  async resetMemory(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE conversations SET long_term_memory = ? WHERE id = ?', ['', id]);
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM group_members WHERE conversation_id = ?', [id]);
    await db.runAsync('DELETE FROM conversations WHERE id = ?', [id]);
  },

  // ── Group Chat ──

  async createGroup(groupName: string, companionIds: string[]): Promise<Conversation> {
    const db = await getDatabase();
    const id = generateId();
    const timestamp = now();

    // Create conversation with first companion as primary (for compatibility)
    await db.runAsync(
      `INSERT INTO conversations (id, companion_id, type, group_name, last_message_at, created_at)
       VALUES (?, ?, 'group', ?, ?, ?)`,
      [id, companionIds[0] || '', groupName, timestamp, timestamp]
    );

    // Add all members
    for (const compId of companionIds) {
      await db.runAsync(
        `INSERT OR IGNORE INTO group_members (id, conversation_id, companion_id, joined_at)
         VALUES (?, ?, ?, ?)`,
        [generateId(), id, compId, timestamp]
      );
    }

    return (await this.getById(id))!;
  },

  async getGroupMembers(conversationId: string): Promise<Array<{ companionId: string }>> {
    const db = await getDatabase();
    return db.getAllAsync<{ companionId: string }>(
      'SELECT companion_id as companionId FROM group_members WHERE conversation_id = ?',
      [conversationId]
    );
  },

  async addGroupMember(conversationId: string, companionId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR IGNORE INTO group_members (id, conversation_id, companion_id, joined_at)
       VALUES (?, ?, ?, ?)`,
      [generateId(), conversationId, companionId, now()]
    );
  },

  async removeGroupMember(conversationId: string, companionId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'DELETE FROM group_members WHERE conversation_id = ? AND companion_id = ?',
      [conversationId, companionId]
    );
  },

  async isGroup(conversationId: string): Promise<boolean> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ type: string }>(
      'SELECT type FROM conversations WHERE id = ?', [conversationId]
    );
    return row?.type === 'group';
  },
};
