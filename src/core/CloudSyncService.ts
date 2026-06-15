/**
 * Curoco — Cloud Sync Service
 * Export/import data for backup and cross-device sync
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getDatabase } from '../db/index';

export interface SyncData {
  version: string;
  exportedAt: string;
  companions: any[];
  conversations: any[];
  messages: any[];
  api_configs: any[];
  app_settings: any[];
  social_posts: any[];
  social_comments: any[];
  social_likes: any[];
  custom_stickers: any[];
  proactive_schedules: any[];
}

export class CloudSyncService {
  /**
   * Export all data to a JSON file and share
   */
  static async exportData(): Promise<{ success: boolean; error?: string }> {
    try {
      const db = await getDatabase();

      // Fetch all data from all tables
      const [companions, conversations, messages, api_configs, app_settings, social_posts, social_comments, social_likes, custom_stickers, proactive_schedules] = await Promise.all([
        db.getAllAsync('SELECT * FROM companions'),
        db.getAllAsync('SELECT * FROM conversations'),
        db.getAllAsync('SELECT * FROM messages'),
        db.getAllAsync('SELECT * FROM api_configs'),
        db.getAllAsync('SELECT * FROM app_settings'),
        db.getAllAsync('SELECT * FROM social_posts'),
        db.getAllAsync('SELECT * FROM social_comments'),
        db.getAllAsync('SELECT * FROM social_likes'),
        db.getAllAsync('SELECT * FROM custom_stickers'),
        db.getAllAsync('SELECT * FROM proactive_schedules'),
      ]);

      const syncData: SyncData = {
        version: '1.3.0',
        exportedAt: new Date().toISOString(),
        companions,
        conversations,
        messages,
        api_configs,
        app_settings,
        social_posts,
        social_comments,
        social_likes,
        custom_stickers,
        proactive_schedules,
      };

      const jsonStr = JSON.stringify(syncData, null, 2);
      const fileName = `curoco_backup_${Date.now()}.json`;
      const filePath = `${FileSystem.cacheDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, jsonStr, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Share the file
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/json',
          dialogTitle: '导出 Curoco 数据备份',
          UTI: 'public.json',
        });
      }

      return { success: true };
    } catch (e: any) {
      console.error('Export failed:', e);
      return { success: false, error: e?.message || '导出失败' };
    }
  }

  /**
   * Import data from a JSON file
   */
  static async importData(): Promise<{ success: boolean; error?: string; imported?: { companions: number; messages: number } }> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) {
        return { success: false, error: '已取消' };
      }

      const file = result.assets[0];
      const jsonStr = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const syncData: SyncData = JSON.parse(jsonStr);

      // Validate data structure
      if (!syncData.version || !syncData.companions || !syncData.messages) {
        return { success: false, error: '备份文件格式无效' };
      }

      const db = await getDatabase();

      // Import data in transaction
      await db.execAsync('BEGIN TRANSACTION');

      try {
        // Clear existing data
        await db.execAsync('DELETE FROM proactive_schedules');
        await db.execAsync('DELETE FROM custom_stickers');
        await db.execAsync('DELETE FROM social_likes');
        await db.execAsync('DELETE FROM social_comments');
        await db.execAsync('DELETE FROM social_posts');
        await db.execAsync('DELETE FROM messages');
        await db.execAsync('DELETE FROM conversations');
        await db.execAsync('DELETE FROM companions');
        await db.execAsync('DELETE FROM api_configs');
        await db.execAsync('DELETE FROM app_settings');

        // Insert companions
        for (const c of syncData.companions) {
          await db.runAsync(
            `INSERT INTO companions (id, name, avatar_uri, gender, age, relationship, nickname_for_user, personality, backstory, world_setting, voice_enabled, tts_voice_id, tts_voice_sample_uri, proactive_message_enabled, auto_followup_enabled, auto_followup_timeout, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [c.id, c.name, c.avatar_uri, c.gender, c.age, c.relationship, c.nickname_for_user, c.personality, c.backstory, c.world_setting, c.voice_enabled, c.tts_voice_id, c.tts_voice_sample_uri, c.proactive_message_enabled, c.auto_followup_enabled, c.auto_followup_timeout, c.created_at, c.updated_at]
          );
        }

        // Insert conversations
        for (const c of syncData.conversations) {
          await db.runAsync(
            `INSERT INTO conversations (id, companion_id, type, group_name, last_message_preview, last_message_at, unread_count, long_term_memory, total_message_count, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [c.id, c.companion_id, c.type || 'private', c.group_name, c.last_message_preview, c.last_message_at, c.unread_count, c.long_term_memory, c.total_message_count, c.created_at]
          );
        }

        // Insert messages
        for (const m of syncData.messages) {
          await db.runAsync(
            `INSERT INTO messages (id, conversation_id, role, type, content, media_uri, media_duration, emotion, speed_modifier, status, is_read, regenerated, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [m.id, m.conversation_id, m.role, m.type || 'text', m.content, m.media_uri, m.media_duration, m.emotion, m.speed_modifier, m.status || 'sent', m.is_read ?? 1, m.regenerated ?? 0, m.created_at]
          );
        }

        // Insert API configs
        for (const c of syncData.api_configs) {
          await db.runAsync(
            `INSERT INTO api_configs (id, provider_type, label, base_url, api_key, model_name, is_active, extra_headers, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [c.id, c.provider_type, c.label, c.base_url, c.api_key, c.model_name, c.is_active, c.extra_headers, c.created_at]
          );
        }

        // Insert app settings
        for (const s of syncData.app_settings) {
          await db.runAsync(
            `INSERT INTO app_settings (key, value) VALUES (?, ?)`,
            [s.key, s.value]
          );
        }

        // Insert social posts
        for (const p of syncData.social_posts) {
          await db.runAsync(
            `INSERT INTO social_posts (id, author_id, author_name, author_avatar_uri, content_text, media_urls, memory_uuid, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.id || p.post_id, p.author_id, p.author_name, p.author_avatar_uri, p.content_text, p.media_urls, p.memory_uuid, p.status || 'active', p.created_at]
          );
        }

        // Insert social comments
        for (const c of syncData.social_comments) {
          await db.runAsync(
            `INSERT INTO social_comments (id, post_id, author_id, author_name, author_avatar_uri, content, reply_to_comment_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [c.id || c.comment_id, c.post_id, c.author_id, c.author_name, c.author_avatar_uri, c.content, c.reply_to_comment_id, c.created_at]
          );
        }

        // Insert social likes
        for (const l of syncData.social_likes) {
          await db.runAsync(
            `INSERT INTO social_likes (post_id, author_id, author_name, created_at) VALUES (?, ?, ?, ?)`,
            [l.post_id, l.author_id, l.author_name, l.created_at]
          );
        }

        // Insert custom stickers
        for (const s of syncData.custom_stickers) {
          await db.runAsync(
            `INSERT INTO custom_stickers (id, file_path, thumbnail_path, mime_type, is_animated, meaning, hash, tags, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [s.id, s.file_path, s.thumbnail_path || '', s.mime_type || 'image/png', s.is_animated ?? 0, s.meaning, s.hash, s.tags || '[]', s.added_at || s.created_at]
          );
        }

        // Insert proactive schedules
        for (const s of syncData.proactive_schedules) {
          await db.runAsync(
            `INSERT INTO proactive_schedules (id, companion_id, type, fixed_times, random_interval_min, random_interval_max, is_active, last_triggered_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [s.id, s.companion_id, s.type || s.schedule_type || 'random', s.fixed_times || '[]', s.random_interval_min || s.interval_hours_min || 4, s.random_interval_max || s.interval_hours_max || 12, s.is_active ?? 0, s.last_triggered_at || s.next_fire_at, s.created_at]
          );
        }

        await db.execAsync('COMMIT');

        return {
          success: true,
          imported: {
            companions: syncData.companions.length,
            messages: syncData.messages.length,
          },
        };
      } catch (e) {
        await db.execAsync('ROLLBACK');
        throw e;
      }
    } catch (e: any) {
      console.error('Import failed:', e);
      return { success: false, error: e?.message || '导入失败' };
    }
  }
}
