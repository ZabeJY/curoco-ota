/**
 * Curoco Space — Social Repository
 * Posts with memory binding, memory erasure on delete
 */

import { getDatabase } from '../index';
import type { SocialPost, SocialComment, SocialLike, PostWithMeta } from '../../types/social';
import { ConversationRepository } from './ConversationRepo';
import { v4 as uuidv4 } from 'uuid';

function genId(): string {
  try { return uuidv4(); } catch { return 's-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
}
function now(): string { return new Date().toISOString(); }

export const SocialRepo = {
  // ── Posts ──

  async createPost(
    authorId: string, authorName: string, authorAvatar: string,
    content: string, mediaUrls: string[] = [], memoryUuid?: string
  ): Promise<SocialPost> {
    const db = await getDatabase();
    const id = genId();
    const ts = now();
    await db.runAsync(
      `INSERT INTO social_posts (id, author_id, author_name, author_avatar_uri, content_text, media_urls, memory_uuid, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [id, authorId, authorName, authorAvatar, content, JSON.stringify(mediaUrls), memoryUuid || null, ts]
    );
    return {
      post_id: id, author_id: authorId, author_name: authorName,
      author_avatar_uri: authorAvatar, content_text: content,
      media_urls: mediaUrls, memory_uuid: memoryUuid || null,
      status: 'active', created_at: ts,
    };
  },

  async getPostWithMeta(postId: string): Promise<PostWithMeta | null> {
    const post = await this.getPost(postId);
    if (!post) return null;
    const db = await getDatabase();
    const likes = await db.getAllAsync<any>(
      'SELECT * FROM social_likes WHERE post_id = ? ORDER BY created_at ASC', [postId]
    );
    const comments = await db.getAllAsync<any>(
      'SELECT * FROM social_comments WHERE post_id = ? ORDER BY created_at ASC', [postId]
    );
    return {
      ...post,
      like_count: likes.length,
      liked_by_me: likes.some((l: any) => l.author_id === 'user'),
      liked_names: likes.map((l: any) => l.author_name),
      comments: comments.map(rowToComment),
      comment_count: comments.length,
    };
  },

  async getPost(postId: string): Promise<SocialPost | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>('SELECT * FROM social_posts WHERE id = ?', [postId]);
    if (!row) return null;
    return {
      post_id: row.id, author_id: row.author_id, author_name: row.author_name,
      author_avatar_uri: row.author_avatar_uri, content_text: row.content_text,
      media_urls: JSON.parse(row.media_urls || '[]'),
      memory_uuid: row.memory_uuid, status: row.status || 'active',
      created_at: row.created_at,
    } as any;
  },

  async getFeed(limit = 50): Promise<PostWithMeta[]> {
    const db = await getDatabase();
    const posts = await db.getAllAsync<any>(
      "SELECT * FROM social_posts WHERE status = 'active' ORDER BY created_at DESC LIMIT ?",
      [limit]
    );

    const result: PostWithMeta[] = [];
    for (const p of posts) {
      const postId = p.id;
      const likes = await db.getAllAsync<any>(
        'SELECT * FROM social_likes WHERE post_id = ? ORDER BY created_at ASC', [postId]
      );
      const comments = await db.getAllAsync<any>(
        'SELECT * FROM social_comments WHERE post_id = ? ORDER BY created_at ASC', [postId]
      );

      result.push({
        post_id: postId, author_id: p.author_id, author_name: p.author_name,
        author_avatar_uri: p.author_avatar_uri, content_text: p.content_text,
        media_urls: JSON.parse(p.media_urls || '[]'),
        memory_uuid: p.memory_uuid, status: p.status || 'active',
        created_at: p.created_at,
        like_count: likes.length,
        liked_by_me: likes.some((l: any) => l.author_id === 'user'),
        liked_names: likes.map((l: any) => l.author_name),
        comments: comments.map(rowToComment),
        comment_count: comments.length,
      });
    }
    return result;
  },

  /**
   * Delete post + erase associated memory from AI's long-term memory
   */
  async deletePostWithMemory(postId: string, companionId?: string): Promise<void> {
    const db = await getDatabase();
    const post = await db.getFirstAsync<any>('SELECT * FROM social_posts WHERE id = ?', [postId]);
    if (!post) return;

    // 1. Erase from long-term memory if linked
    if (post.memory_uuid && companionId) {
      try {
        const conv = await ConversationRepository.getByCompanionId(companionId);
        if (conv && conv.longTermMemorySummary) {
          // Remove the memory slice from long-term summary
          const lines = conv.longTermMemorySummary.split('\n');
          const filtered = lines.filter((line) => !line.includes(post.memory_uuid));
          await ConversationRepository.updateLongTermMemory(
            conv.id,
            filtered.join('\n')
          );
        }
      } catch (e) {
        console.warn('Memory erasure failed:', e);
      }
    }

    // 2. Delete comments and likes
    await db.runAsync('DELETE FROM social_comments WHERE post_id = ?', [postId]);
    await db.runAsync('DELETE FROM social_likes WHERE post_id = ?', [postId]);

    // 3. Mark as deleted (soft delete)
    await db.runAsync(
      "UPDATE social_posts SET status = 'deleted' WHERE id = ?",
      [postId]
    );
  },

  /**
   * Simple delete (no memory erasure)
   */
  async deletePost(postId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM social_comments WHERE post_id = ?', [postId]);
    await db.runAsync('DELETE FROM social_likes WHERE post_id = ?', [postId]);
    await db.runAsync("UPDATE social_posts SET status = 'deleted' WHERE id = ?", [postId]);
  },

  // ── Likes ──

  async toggleLike(postId: string, authorId: string, authorName: string): Promise<boolean> {
    const db = await getDatabase();
    const existing = await db.getFirstAsync<any>(
      'SELECT * FROM social_likes WHERE post_id = ? AND author_id = ?', [postId, authorId]
    );
    if (existing) {
      await db.runAsync('DELETE FROM social_likes WHERE post_id = ? AND author_id = ?', [postId, authorId]);
      return false;
    } else {
      await db.runAsync(
        'INSERT INTO social_likes (post_id, author_id, author_name, created_at) VALUES (?, ?, ?, ?)',
        [postId, authorId, authorName, now()]
      );
      return true;
    }
  },

  // ── Comments ──

  async addComment(
    postId: string, authorId: string, authorName: string, authorAvatar: string,
    content: string, replyToCommentId: string | null = null, replyToAuthorName: string | null = null
  ): Promise<SocialComment> {
    const db = await getDatabase();
    const id = genId();
    await db.runAsync(
      `INSERT INTO social_comments (id, post_id, author_id, author_name, author_avatar_uri, reply_to_comment_id, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, postId, authorId, authorName, authorAvatar, replyToCommentId, content, now()]
    );
    return {
      comment_id: id, post_id: postId, author_id: authorId, author_name: authorName,
      author_avatar_uri: authorAvatar, reply_to_comment_id: replyToCommentId,
      reply_to_author_name: replyToAuthorName, content, created_at: now(),
    };
  },

  async getComments(postId: string): Promise<SocialComment[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      'SELECT * FROM social_comments WHERE post_id = ? ORDER BY created_at ASC', [postId]
    );
    return rows.map(rowToComment);
  },

  /**
   * Delete a comment, and if linked to memory, erase memory too
   */
  async deleteComment(commentId: string, companionId?: string): Promise<void> {
    const db = await getDatabase();
    const comment = await db.getFirstAsync<any>('SELECT * FROM social_comments WHERE id = ?', [commentId]);
    if (!comment) return;

    // If this comment has a memory link, erase it
    if (comment.memory_uuid && companionId) {
      try {
        const conv = await ConversationRepository.getByCompanionId(companionId);
        if (conv && conv.longTermMemorySummary) {
          const lines = conv.longTermMemorySummary.split('\n');
          const filtered = lines.filter((line) => !line.includes(comment.memory_uuid));
          await ConversationRepository.updateLongTermMemory(conv.id, filtered.join('\n'));
        }
      } catch (e) {
        console.warn('Memory erasure for comment failed:', e);
      }
    }

    await db.runAsync('DELETE FROM social_comments WHERE id = ?', [commentId]);
  },

  /**
   * Get comment by ID
   */
  async getComment(commentId: string): Promise<SocialComment | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>('SELECT * FROM social_comments WHERE id = ?', [commentId]);
    return row ? rowToComment(row) : null;
  },
};

function rowToComment(r: any): SocialComment {
  return {
    comment_id: r.id, post_id: r.post_id, author_id: r.author_id,
    author_name: r.author_name, author_avatar_uri: r.author_avatar_uri || '',
    reply_to_comment_id: r.reply_to_comment_id || null,
    reply_to_author_name: null, content: r.content, created_at: r.created_at,
  };
}
