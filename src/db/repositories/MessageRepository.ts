/**
 * Curoco — Message Repository (Fixed)
 * - User messages default to is_read = 1
 * - Standardized timestamps
 */

import { getDatabase } from '../index';
import type { Message, MessageRole, MessageType, MessageStatus } from '../../types/models';
import { v4 as uuidv4 } from 'uuid';

function generateId(): string {
  try { return uuidv4(); } catch { return 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
}

function now(): string { return new Date().toISOString(); }

function rowToMessage(row: any): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role as MessageRole,
    type: row.type as MessageType,
    content: row.content,
    mediaUri: row.media_uri,
    mediaDuration: row.media_duration,
    emotion: row.emotion,
    speedModifier: row.speed_modifier,
    status: row.status as MessageStatus,
    isRead: row.is_read === 1,
    regenerated: row.regenerated === 1,
    createdAt: row.created_at,
    quoteId: row.quote_id || null,
    quoteContent: row.quote_content || null,
    quoteRole: row.quote_role || null,
  };
}

export const MessageRepository = {
  async getRecent(conversationId: string, limit: number): Promise<Message[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync(
      `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?`,
      [conversationId, limit]
    );
    return rows.reverse().map(rowToMessage);
  },

  async getOlderMessages(conversationId: string, beforeTimestamp: string, limit: number): Promise<Message[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync(
      `SELECT * FROM messages WHERE conversation_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`,
      [conversationId, beforeTimestamp, limit]
    );
    return rows.reverse().map(rowToMessage);
  },

  async getOlderThan(conversationId: string, offset: number, limit: number): Promise<Message[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync(
      `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?`,
      [conversationId, limit, offset]
    );
    return rows.map(rowToMessage);
  },

  async getByConversation(
    conversationId: string,
    before?: string,
    limit: number = 50
  ): Promise<Message[]> {
    const db = await getDatabase();
    let query = `SELECT * FROM messages WHERE conversation_id = ?`;
    const params: any[] = [conversationId];

    if (before) {
      query += ` AND created_at < ?`;
      params.push(before);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const rows = await db.getAllAsync(query, params);
    return rows.reverse().map(rowToMessage);
  },

  async getById(id: string): Promise<Message | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync('SELECT * FROM messages WHERE id = ?', [id]);
    return row ? rowToMessage(row) : null;
  },

  async create(data: {
    conversationId: string;
    role: MessageRole;
    type?: MessageType;
    content: string;
    mediaUri?: string | null;
    mediaDuration?: number | null;
    emotion?: string | null;
    speedModifier?: number | null;
    status?: MessageStatus;
    quoteId?: string | null;
    quoteContent?: string | null;
    quoteRole?: string | null;
  }): Promise<Message> {
    const db = await getDatabase();
    const id = generateId();
    const timestamp = now();
    // User messages are always read; AI messages start unread
    const isRead = data.role === 'user' ? 1 : 0;

    await db.runAsync(
      `INSERT INTO messages (id, conversation_id, role, type, content, media_uri, media_duration,
        emotion, speed_modifier, status, is_read, created_at, quote_id, quote_content, quote_role)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, data.conversationId, data.role,
        data.type || 'text', data.content,
        data.mediaUri || null, data.mediaDuration || null,
        data.emotion || null, data.speedModifier || null,
        data.status || 'sent', isRead, timestamp,
        data.quoteId || null, data.quoteContent || null, data.quoteRole || null,
      ]
    );

    return (await this.getById(id))!;
  },

  async updateStatus(id: string, status: MessageStatus): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE messages SET status = ? WHERE id = ?', [status, id]);
  },

  async updateContent(id: string, content: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE messages SET content = ? WHERE id = ?', [content, id]);
  },

  async markAsRead(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('UPDATE messages SET is_read = 1 WHERE id = ?', [id]);
  },

  async markConversationRead(conversationId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND is_read = 0',
      [conversationId]
    );
  },

  async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await getDatabase();
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(`DELETE FROM messages WHERE id IN (${placeholders})`, ids);
  },

  async getRecentSystem(conversationId: string, limit: number): Promise<Array<{ content: string; createdAt: string }>> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ content: string; created_at: string }>(
      `SELECT content, created_at FROM messages WHERE conversation_id = ? AND role = 'system' ORDER BY created_at DESC LIMIT ?`,
      [conversationId, limit]
    );
    return rows.reverse().map(r => ({ content: r.content, createdAt: r.created_at }));
  },

  async count(conversationId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM messages WHERE conversation_id = ?',
      [conversationId]
    );
    return row?.cnt ?? 0;
  },

  /**
   * Recall (delete) a message and update conversation preview
   */
  async recallMessage(messageId: string, conversationId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM messages WHERE id = ?', [messageId]);

    // Refresh the conversation's last message preview
    const lastMsg = await db.getFirstAsync<any>(
      'SELECT content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1',
      [conversationId]
    );
    const preview = lastMsg?.content?.slice(0, 50) || '';
    const timestamp = lastMsg?.created_at || new Date().toISOString();
    await db.runAsync(
      'UPDATE conversations SET last_message_preview = ?, last_message_at = ? WHERE id = ?',
      [preview, timestamp, conversationId]
    );
  },

  /**
   * Get the last non-recalled message for a conversation (for chat list preview)
   */
  async getLastMessage(conversationId: string): Promise<Message | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1',
      [conversationId]
    );
    return row ? rowToMessage(row) : null;
  },

  /**
   * Search messages by keyword within a companion's conversations
   */
  async searchByCompanion(companionId: string, keyword: string, limit: number = 50): Promise<Message[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync(
      `SELECT m.* FROM messages m
       INNER JOIN conversations c ON m.conversation_id = c.id
       WHERE c.companion_id = ? AND m.content LIKE ?
       ORDER BY m.created_at DESC LIMIT ?`,
      [companionId, `%${keyword}%`, limit]
    );
    return rows.map(rowToMessage);
  },
};
