/**
 * Curoco — Database Migrations
 * Single comprehensive migration that creates all tables
 */

import { type SQLiteDatabase } from 'expo-sqlite';

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  // Single comprehensive CREATE TABLE with ALL columns
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS companions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar_uri TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT 'other',
      age INTEGER NOT NULL DEFAULT 20,
      relationship TEXT NOT NULL DEFAULT 'friend',
      nickname_for_user TEXT NOT NULL DEFAULT '',
      personality TEXT NOT NULL DEFAULT '',
      backstory TEXT NOT NULL DEFAULT '',
      world_setting TEXT NOT NULL DEFAULT '',
      voice_enabled INTEGER NOT NULL DEFAULT 0,
      proactive_message_enabled INTEGER NOT NULL DEFAULT 0,
      proactive_interval_min INTEGER NOT NULL DEFAULT 4,
      proactive_interval_max INTEGER NOT NULL DEFAULT 12,
      tts_voice_id TEXT,
      tts_voice_sample_uri TEXT,
      cover_uri TEXT,
      signature TEXT,
      auto_followup_enabled INTEGER NOT NULL DEFAULT 0,
      auto_followup_timeout INTEGER NOT NULL DEFAULT 30,
      speaking_style TEXT NOT NULL DEFAULT '',
      taboo_topics TEXT NOT NULL DEFAULT '',
      likes TEXT NOT NULL DEFAULT '',
      catchphrase TEXT NOT NULL DEFAULT '',
      emotion_style TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      companion_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'private',
      group_name TEXT,
      last_message_preview TEXT NOT NULL DEFAULT '',
      last_message_at TEXT NOT NULL DEFAULT '',
      unread_count INTEGER NOT NULL DEFAULT 0,
      long_term_memory TEXT NOT NULL DEFAULT '',
      total_message_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      content TEXT NOT NULL DEFAULT '',
      media_uri TEXT,
      media_duration REAL,
      emotion TEXT,
      speed_modifier REAL,
      status TEXT NOT NULL DEFAULT 'sent',
      is_read INTEGER NOT NULL DEFAULT 1,
      regenerated INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS api_configs (
      id TEXT PRIMARY KEY,
      provider_type TEXT NOT NULL,
      label TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT NOT NULL,
      model_name TEXT,
      is_active INTEGER NOT NULL DEFAULT 0,
      extra_headers TEXT,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS social_posts (
      id TEXT PRIMARY KEY,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_avatar_uri TEXT NOT NULL DEFAULT '',
      content_text TEXT NOT NULL DEFAULT '',
      media_urls TEXT NOT NULL DEFAULT '[]',
      memory_uuid TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS social_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_avatar_uri TEXT NOT NULL DEFAULT '',
      reply_to_comment_id TEXT,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS social_likes (
      post_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (post_id, author_id)
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      companion_id TEXT NOT NULL,
      companion_name TEXT NOT NULL,
      companion_avatar_uri TEXT NOT NULL DEFAULT '',
      joined_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS custom_stickers (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      thumbnail_path TEXT NOT NULL DEFAULT '',
      mime_type TEXT NOT NULL DEFAULT 'image/png',
      is_animated INTEGER NOT NULL DEFAULT 0,
      meaning TEXT NOT NULL DEFAULT '',
      hash TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      added_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS proactive_schedules (
      id TEXT PRIMARY KEY,
      companion_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'random',
      fixed_times TEXT NOT NULL DEFAULT '[]',
      random_interval_min INTEGER NOT NULL DEFAULT 4,
      random_interval_max INTEGER NOT NULL DEFAULT 12,
      is_active INTEGER NOT NULL DEFAULT 0,
      last_triggered_at TEXT,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '✅',
      color TEXT NOT NULL DEFAULT '#6C63FF',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS habit_records (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_conv_companion ON conversations(companion_id);
    CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_api_type ON api_configs(provider_type, is_active);
    CREATE INDEX IF NOT EXISTS idx_post_author ON social_posts(author_id);
    CREATE INDEX IF NOT EXISTS idx_comment_post ON social_comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_habit_record_date ON habit_records(habit_id, date);
  `);

  // Ensure new columns exist on older databases
  try {
    const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(companions)`);
    const colNames = cols.map(c => c.name);

    const addCol = async (name: string, type: string, def: string) => {
      if (!colNames.includes(name)) {
        try {
          await db.execAsync(`ALTER TABLE companions ADD COLUMN ${name} ${type} DEFAULT ${def}`);
          console.log(`Added column: ${name}`);
        } catch (e) {
          console.warn(`Failed to add column ${name}:`, e);
        }
      }
    };

    await addCol('cover_uri', 'TEXT', "''");
    await addCol('signature', 'TEXT', "''");
    await addCol('chat_background_uri', 'TEXT', "''");
    await addCol('auto_followup_enabled', 'INTEGER', '0');
    await addCol('auto_followup_timeout', 'INTEGER', '30');
    await addCol('speaking_style', 'TEXT', "''");
    await addCol('taboo_topics', 'TEXT', "''");
    await addCol('likes', 'TEXT', "''");
    await addCol('catchphrase', 'TEXT', "''");
    await addCol('emotion_style', 'TEXT', "''");
    await addCol('chat_background_opacity', 'REAL', '0.15');
  } catch (e) {
    console.warn('Migration check failed:', e);
  }

  // Migrate social_posts columns if old schema exists
  try {
    const postCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(social_posts)`);
    const postColNames = postCols.map(c => c.name);
    if (postColNames.includes('content') && !postColNames.includes('content_text')) {
      await db.execAsync(`ALTER TABLE social_posts ADD COLUMN content_text TEXT DEFAULT ''`);
      await db.execAsync(`UPDATE social_posts SET content_text = content WHERE content_text = ''`);
    }
    if (postColNames.includes('image_uris') && !postColNames.includes('media_urls')) {
      await db.execAsync(`ALTER TABLE social_posts ADD COLUMN media_urls TEXT DEFAULT '[]'`);
      await db.execAsync(`UPDATE social_posts SET media_urls = image_uris WHERE media_urls = '[]'`);
    }
    // Add memory_uuid and status columns to social_posts if missing
    try {
      const postCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(social_posts)`);
      const postColNames = postCols.map(c => c.name);
      if (!postColNames.includes('memory_uuid')) {
        await db.execAsync(`ALTER TABLE social_posts ADD COLUMN memory_uuid TEXT`);
      }
      if (!postColNames.includes('status')) {
        await db.execAsync(`ALTER TABLE social_posts ADD COLUMN status TEXT DEFAULT 'active'`);
      }
    } catch (e) { console.warn('Social posts migration:', e); }

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS social_likes (
        post_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (post_id, author_id)
      )
    `);
    const commentCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(social_comments)`);
    const commentColNames = commentCols.map(c => c.name);
    if (!commentColNames.includes('reply_to_comment_id')) {
      await db.execAsync(`ALTER TABLE social_comments ADD COLUMN reply_to_comment_id TEXT`);
    }
  } catch (e) {
    console.warn('Social migration:', e);
  }

  // Check messages table too
  try {
    const msgCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(messages)`);
    const msgColNames = msgCols.map(c => c.name);
    if (!msgColNames.includes('regenerated')) {
      await db.execAsync(`ALTER TABLE messages ADD COLUMN regenerated INTEGER DEFAULT 0`);
    }
  } catch (e) { console.warn('Messages migration:', e); }

  // Check conversations table
  try {
    const convCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(conversations)`);
    const convColNames = convCols.map(c => c.name);
    if (!convColNames.includes('type')) {
      await db.execAsync(`ALTER TABLE conversations ADD COLUMN type TEXT DEFAULT 'private'`);
    }
    if (!convColNames.includes('group_name')) {
      await db.execAsync(`ALTER TABLE conversations ADD COLUMN group_name TEXT`);
    }
  } catch (e) { console.warn('Conversations migration:', e); }

  // Add quote columns to messages table
  try {
    const msgCols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(messages)`);
    const msgColNames = msgCols.map(c => c.name);
    if (!msgColNames.includes('quote_id')) {
      await db.execAsync(`ALTER TABLE messages ADD COLUMN quote_id TEXT`);
    }
    if (!msgColNames.includes('quote_content')) {
      await db.execAsync(`ALTER TABLE messages ADD COLUMN quote_content TEXT`);
    }
    if (!msgColNames.includes('quote_role')) {
      await db.execAsync(`ALTER TABLE messages ADD COLUMN quote_role TEXT`);
    }
  } catch (e) { console.warn('Quote migration:', e); }

  // Migrate habit_records: remove UNIQUE constraint to allow multiple check-ins per day
  try {
    const tableInfo = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(habit_records)`);
    const hasUnique = await db.getFirstAsync<{ sql: string }>(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='habit_records'`
    );
    // If the table has UNIQUE(habit_id, date), recreate without it
    if (hasUnique?.sql?.includes('UNIQUE')) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS habit_records_new (
          id TEXT PRIMARY KEY,
          habit_id TEXT NOT NULL,
          date TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT ''
        );
        INSERT INTO habit_records_new SELECT id, habit_id, date, created_at FROM habit_records;
        DROP TABLE habit_records;
        ALTER TABLE habit_records_new RENAME TO habit_records;
        CREATE INDEX IF NOT EXISTS idx_habit_record_date ON habit_records(habit_id, date);
      `);
      console.log('Migrated habit_records: removed UNIQUE constraint');
    }
  } catch (e) { console.warn('Habit records migration:', e); }
}
