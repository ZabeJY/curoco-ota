/**
 * Curoco — Social Repository (Curoco Space)
 */

import { getDatabase } from '../index';
import type { SocialPost, SocialComment } from '../../types/models';
import { v4 as uuidv4 } from 'uuid';

function genId(): string { try { return uuidv4(); } catch { return 's-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); } }
function now(): string { return new Date().toISOString(); }

function rowToPost(r: any): SocialPost {
  return { id: r.id, authorId: r.author_id, authorName: r.author_name, authorAvatarUri: r.author_avatar_uri, content: r.content, imageUris: r.image_uris, likeCount: r.like_count, likedByMe: r.liked_by_me === 1, createdAt: r.created_at };
}

function rowToComment(r: any): SocialComment {
  return { id: r.id, postId: r.post_id, authorId: r.author_id, authorName: r.author_name, authorAvatarUri: r.author_avatar_uri, content: r.content, createdAt: r.created_at };
}

export const SocialRepository = {
  async getPosts(limit = 50): Promise<SocialPost[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync('SELECT * FROM social_posts ORDER BY created_at DESC LIMIT ?', [limit]);
    return rows.map(rowToPost);
  },

  async createPost(authorId: string, authorName: string, authorAvatarUri: string, content: string, imageUris: string[] = []): Promise<SocialPost> {
    const db = await getDatabase();
    const id = genId();
    await db.runAsync(
      `INSERT INTO social_posts (id, author_id, author_name, author_avatar_uri, content, image_uris, like_count, liked_by_me, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)`,
      [id, authorId, authorName, authorAvatarUri, content, JSON.stringify(imageUris), now()]
    );
    const row = await db.getFirstAsync('SELECT * FROM social_posts WHERE id = ?', [id]);
    return rowToPost(row!);
  },

  async toggleLike(postId: string): Promise<boolean> {
    const db = await getDatabase();
    const post = await db.getFirstAsync<{ liked_by_me: number; like_count: number }>('SELECT * FROM social_posts WHERE id = ?', [postId]);
    if (!post) return false;
    const liked = post.liked_by_me === 0;
    await db.runAsync('UPDATE social_posts SET liked_by_me = ?, like_count = like_count + ? WHERE id = ?', [liked ? 1 : 0, liked ? 1 : -1, postId]);
    return liked;
  },

  async deletePost(postId: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM social_posts WHERE id = ?', [postId]);
  },

  async getComments(postId: string): Promise<SocialComment[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync('SELECT * FROM social_comments WHERE post_id = ? ORDER BY created_at ASC', [postId]);
    return rows.map(rowToComment);
  },

  async addComment(postId: string, authorId: string, authorName: string, authorAvatarUri: string, content: string): Promise<SocialComment> {
    const db = await getDatabase();
    const id = genId();
    await db.runAsync(
      `INSERT INTO social_comments (id, post_id, author_id, author_name, author_avatar_uri, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, postId, authorId, authorName, authorAvatarUri, content, now()]
    );
    const row = await db.getFirstAsync('SELECT * FROM social_comments WHERE id = ?', [id]);
    return rowToComment(row!);
  },
};
