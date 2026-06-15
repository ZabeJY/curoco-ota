/**
 * Curoco — Group Chat Repository
 */

import { getDatabase } from '../index';
import type { GroupMember } from '../../types/models';
import { v4 as uuidv4 } from 'uuid';

function genId(): string { try { return uuidv4(); } catch { return 'g-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); } }
function now(): string { return new Date().toISOString(); }

export const GroupRepository = {
  async getMembers(conversationId: string): Promise<GroupMember[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync('SELECT * FROM group_members WHERE conversation_id = ?', [conversationId]);
    return rows.map((r: any) => ({
      id: r.id, conversationId: r.conversation_id, companionId: r.companion_id,
      companionName: r.companion_name, companionAvatarUri: r.companion_avatar_uri, joinedAt: r.joined_at,
    }));
  },

  async addMember(conversationId: string, companionId: string, companionName: string, companionAvatarUri: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO group_members (id, conversation_id, companion_id, companion_name, companion_avatar_uri, joined_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [genId(), conversationId, companionId, companionName, companionAvatarUri, now()]
    );
  },

  async removeMember(conversationId: string, companionId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM group_members WHERE conversation_id = ? AND companion_id = ?', [conversationId, companionId]);
  },

  async createGroupConversation(groupName: string, companionIds: string[], companionNames: string[]): Promise<string> {
    const db = await getDatabase();
    const id = genId();
    const timestamp = now();
    await db.runAsync(
      `INSERT INTO conversations (id, companion_id, type, group_name, last_message_at, created_at) VALUES (?, ?, 'group', ?, ?, ?)`,
      [id, companionIds[0] || '', groupName, timestamp, timestamp]
    );
    for (let i = 0; i < companionIds.length; i++) {
      await db.runAsync(
        `INSERT INTO group_members (id, conversation_id, companion_id, companion_name, companion_avatar_uri, joined_at) VALUES (?, ?, ?, ?, '', ?)`,
        [genId(), id, companionIds[i], companionNames[i] || '', timestamp]
      );
    }
    return id;
  },
};
