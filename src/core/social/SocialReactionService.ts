/**
 * Curoco — Social Reaction Service
 * Global service: AI companions react to user posts after a delay.
 * Survives component unmount. Fetches fresh data each time.
 */

import { SocialRepo } from '../../db/repositories/SocialRepositoryNew';
import { CompanionRepository } from '../../db/repositories/CompanionRepository';

// Global timer map — keyed by postId
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

const AI_REACTIONS = [
  (name: string) => `${name}说得好有道理！`,
  (name: string) => `哈哈，${name}也太有趣了吧～`,
  (name: string) => `嗯嗯，我也这么觉得呢！`,
  (name: string) => `${name}今天心情不错嘛～`,
  (name: string) => `哇，${name}今天看起来很开心呀！`,
  (name: string) => `${name}，你说的我好喜欢～`,
  (name: string) => `${name}果然是我的宝藏！`,
  (name: string) => `嘻嘻，${name}太可爱了～`,
];

const AI_LIKE_CHANCE = 0.4; // 40% chance to also like

export const SocialReactionService = {
  /**
   * Schedule an AI reaction to a user post.
   * Delay: 35-60 seconds random.
   * Each companion may comment; some may also like.
   */
  scheduleReaction(postId: string, userContent: string): void {
    // Cancel any existing timer for this post
    this.cancelReaction(postId);

    const delay = 35000 + Math.floor(Math.random() * 25000);

    const timer = setTimeout(async () => {
      pendingTimers.delete(postId);

      try {
        // Fetch fresh companions (not stale closure)
        const companions = await CompanionRepository.getAll();
        if (companions.length === 0) return;

        // Pick 1-2 random companions to react
        const reactorCount = Math.min(companions.length, 1 + (Math.random() < 0.3 ? 1 : 0));
        const shuffled = [...companions].sort(() => Math.random() - 0.5);
        const reactors = shuffled.slice(0, reactorCount);

        for (const comp of reactors) {
          const nickname = comp.nicknameForUser || '你';
          const reactionFn = AI_REACTIONS[Math.floor(Math.random() * AI_REACTIONS.length)];
          const commentText = reactionFn(nickname);

          try {
            // Add comment
            await SocialRepo.addComment(
              postId, comp.id, comp.name, comp.avatarUri || '', commentText
            );

            // Maybe also like
            if (Math.random() < AI_LIKE_CHANCE) {
              await SocialRepo.toggleLike(postId, comp.id, comp.name);
            }
          } catch (e) {
            console.warn(`Social reaction failed for ${comp.name}:`, e);
          }
        }

        console.log(`Social reaction: ${reactors.length} companion(s) reacted to post ${postId}`);
      } catch (e) {
        console.warn('Social reaction service error:', e);
      }
    }, delay);

    pendingTimers.set(postId, timer);
    console.log(`Social reaction scheduled for post ${postId} in ${Math.round(delay / 1000)}s`);
  },

  /**
   * Cancel a pending reaction (e.g., if post is deleted)
   */
  cancelReaction(postId: string): void {
    const timer = pendingTimers.get(postId);
    if (timer) {
      clearTimeout(timer);
      pendingTimers.delete(postId);
    }
  },

  /**
   * Cancel all pending reactions
   */
  cancelAll(): void {
    for (const [, timer] of pendingTimers) {
      clearTimeout(timer);
    }
    pendingTimers.clear();
  },
};
