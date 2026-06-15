/**
 * Curoco Space — Social Module Types
 * Three core tables: Posts, Comments, Likes
 */

// ============================================================
// Posts (动态主表)
// ============================================================
export interface SocialPost {
  post_id: string;           // UUID
  author_id: string;         // 'user' 或 companion.id
  author_name: string;
  author_avatar_uri: string;
  content_text: string;      // 动态文本内容
  media_urls: string[];      // 多张图片路径数组
  memory_uuid: string | null; // 关联的记忆锚点
  status: 'active' | 'deleted';
  created_at: string;        // ISO 8601
}

// ============================================================
// Comments (评论表，支持楼中楼)
// ============================================================
export interface SocialComment {
  comment_id: string;        // UUID
  post_id: string;           // 关联动态
  author_id: string;         // 评论者 ID
  author_name: string;
  author_avatar_uri: string;
  reply_to_comment_id: string | null;  // 被回复的评论 ID（楼中楼）
  reply_to_author_name: string | null; // 被回复者名字（显示用）
  content: string;           // 评论文本
  created_at: string;
}

// ============================================================
// Likes (点赞表)
// ============================================================
export interface SocialLike {
  post_id: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

// ============================================================
// Display types (前端展示用)
// ============================================================
export interface PostWithMeta extends SocialPost {
  like_count: number;
  liked_by_me: boolean;
  liked_names: string[];           // 点赞者名字列表
  comments: SocialComment[];       // 该动态的所有评论
  comment_count: number;
}

// ============================================================
// AI Reaction Prompt Template
// ============================================================
export const AI_REACTION_PROMPT = `你的主人刚刚在社交空间发布了一条动态，内容为：「{content}」
请根据你的人设和性格，决定是否要点赞，并写下一句符合你语气的简短评论。
要求：
- 评论要自然、口语化，像真人朋友的回复
- 不要太长，1-2句话即可
- 可以用 emoji 表达情感
- 如果觉得不合适评论，可以只点赞不评论`;

export const AI_PROACTIVE_POST_PROMPT = `现在是{time}，请根据你的人设和当前时间，发布一条社交动态。
要求：
- 像真人发朋友圈一样自然
- 可以分享心情、日常、想法
- 不要太长，2-3句话
- 可以用 emoji
- 要符合你当前时间的状态（如深夜感慨、午后小确幸、周末出游等）`;

export const AI_COMMENT_REPLY_PROMPT = `有人在你的动态下评论了：「{comment_content}」
请根据你的人设，回复这条评论。要求自然、口语化，像真人回复朋友评论一样。`;
