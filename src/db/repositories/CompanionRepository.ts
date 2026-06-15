/**
 * Curoco — Companion Repository (Fixed)
 * - Standardized timestamps (ISO 8601 everywhere)
 * - All fields included in update
 */

import { getDatabase } from '../index';
import type { Companion } from '../../types/models';
import { v4 as uuidv4 } from 'uuid';

function generateId(): string {
  try {
    return uuidv4();
  } catch {
    return 'c-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
}

function now(): string {
  return new Date().toISOString();
}

function rowToCompanion(row: any): Companion {
  return {
    id: row.id,
    name: row.name,
    avatarUri: row.avatar_uri,
    gender: row.gender,
    age: row.age,
    relationship: row.relationship,
    nicknameForUser: row.nickname_for_user,
    personality: row.personality,
    backstory: row.backstory,
    worldSetting: row.world_setting,
    voiceEnabled: row.voice_enabled === 1,
    proactiveMessageEnabled: row.proactive_message_enabled === 1,
    proactiveMessageIntervalMin: row.proactive_interval_min,
    proactiveMessageIntervalMax: row.proactive_interval_max,
    autoFollowUpEnabled: row.auto_followup_enabled === 1,
    autoFollowUpTimeoutMin: row.auto_followup_timeout || 30,
    ttsVoiceId: row.tts_voice_id,
    ttsVoiceSampleUri: row.tts_voice_sample_uri,
    coverUri: row.cover_uri || null,
    signature: row.signature || null,
    chatBackgroundUri: row.chat_background_uri || null,
    speakingStyle: row.speaking_style || '',
    tabooTopics: row.taboo_topics || '',
    likes: row.likes || '',
    catchphrase: row.catchphrase || '',
    emotionStyle: row.emotion_style || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const CompanionRepository = {
  async getAll(): Promise<Companion[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync('SELECT * FROM companions ORDER BY created_at DESC');
    return rows.map(rowToCompanion);
  },

  async getById(id: string): Promise<Companion | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync('SELECT * FROM companions WHERE id = ?', [id]);
    return row ? rowToCompanion(row) : null;
  },

  async create(data: Omit<Companion, 'id' | 'createdAt' | 'updatedAt'>): Promise<Companion> {
    const db = await getDatabase();
    const id = generateId();
    const timestamp = now();

    await db.runAsync(
      `INSERT INTO companions (id, name, avatar_uri, gender, age, relationship, nickname_for_user,
        personality, backstory, world_setting, voice_enabled, proactive_message_enabled,
        proactive_interval_min, proactive_interval_max, tts_voice_id, tts_voice_sample_uri,
        cover_uri, signature, chat_background_uri, auto_followup_enabled, auto_followup_timeout,
        speaking_style, taboo_topics, likes, catchphrase, emotion_style,
        created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, data.name, data.avatarUri, data.gender, data.age, data.relationship,
        data.nicknameForUser, data.personality, data.backstory, data.worldSetting,
        data.voiceEnabled ? 1 : 0, data.proactiveMessageEnabled ? 1 : 0,
        data.proactiveMessageIntervalMin, data.proactiveMessageIntervalMax,
        data.ttsVoiceId, data.ttsVoiceSampleUri,
        data.coverUri || '', data.signature || '', data.chatBackgroundUri || '',
        data.autoFollowUpEnabled ? 1 : 0, data.autoFollowUpTimeoutMin || 30,
        data.speakingStyle || '', data.tabooTopics || '', data.likes || '',
        data.catchphrase || '', data.emotionStyle || '',
        timestamp, timestamp,
      ]
    );

    return (await this.getById(id))!;
  },

  async update(id: string, data: Partial<Companion>): Promise<void> {
    const db = await getDatabase();
    const fields: string[] = [];
    const values: any[] = [];

    const map: [keyof Companion, string, (v: any) => any][] = [
      ['name', 'name', (v) => v],
      ['avatarUri', 'avatar_uri', (v) => v],
      ['gender', 'gender', (v) => v],
      ['age', 'age', (v) => v],
      ['relationship', 'relationship', (v) => v],
      ['nicknameForUser', 'nickname_for_user', (v) => v],
      ['personality', 'personality', (v) => v],
      ['backstory', 'backstory', (v) => v],
      ['worldSetting', 'world_setting', (v) => v],
      ['voiceEnabled', 'voice_enabled', (v) => (v ? 1 : 0)],
      ['proactiveMessageEnabled', 'proactive_message_enabled', (v) => (v ? 1 : 0)],
      ['proactiveMessageIntervalMin', 'proactive_interval_min', (v) => v],
      ['proactiveMessageIntervalMax', 'proactive_interval_max', (v) => v],
      ['autoFollowUpEnabled', 'auto_followup_enabled', (v) => (v ? 1 : 0)],
      ['autoFollowUpTimeoutMin', 'auto_followup_timeout', (v) => v],
      ['ttsVoiceId', 'tts_voice_id', (v) => v],
      ['ttsVoiceSampleUri', 'tts_voice_sample_uri', (v) => v],
      ['coverUri', 'cover_uri', (v) => v],
      ['signature', 'signature', (v) => v],
      ['chatBackgroundUri', 'chat_background_uri', (v) => v],
      ['speakingStyle', 'speaking_style', (v) => v],
      ['tabooTopics', 'taboo_topics', (v) => v],
      ['likes', 'likes', (v) => v],
      ['catchphrase', 'catchphrase', (v) => v],
      ['emotionStyle', 'emotion_style', (v) => v],
    ];

    for (const [key, col, transform] of map) {
      if (data[key] !== undefined) {
        fields.push(`${col} = ?`);
        values.push(transform(data[key]));
      }
    }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    values.push(now());
    values.push(id);

    await db.runAsync(`UPDATE companions SET ${fields.join(', ')} WHERE id = ?`, values);
  },

  async delete(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM companions WHERE id = ?', [id]);
  },
};
