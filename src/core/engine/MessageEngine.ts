/**
 * Curoco — Message Engine (Fixed)
 * - Cancellation support
 * - Smooth typing indicator (no flicker between messages)
 */

import { LLMClient } from '../api/LLMClient';
import { VisionClient } from '../api/VisionClient';
import { PromptBuilder, type MediaState } from './PromptBuilder';
import { ResponseParser } from './ResponseParser';
import { PauseScheduler } from './PauseScheduler';
import { ActiveMemory } from '../memory/ActiveMemory';
import { SummaryWorker } from '../memory/SummaryWorker';
import type { QueuedMessage } from '../../types/message';
import type { Message, ApiConfig } from '../../types/models';
import type { PersonaConfig } from '../../types/persona';
import { SocialRepo } from '../../db/repositories/SocialRepositoryNew';

export interface MessageEngineCallbacks {
  onTypingStart: () => void;
  onTypingEnd: () => void;
  onQueuedMessage: (msg: QueuedMessage) => Promise<void> | void;
  onAllMessagesSent: () => void;
  onError: (error: Error) => void;
}

export class MessageEngine {
  private llmClient: LLMClient;
  private visionClient: VisionClient;
  private pauseScheduler: PauseScheduler;
  private activeMemory: ActiveMemory;
  private summaryWorker: SummaryWorker;
  private persona: PersonaConfig;
  private callbacks: MessageEngineCallbacks;
  private cancelled = false;
  private mediaState: MediaState = 'chatroom';

  constructor(
    llmConfig: ApiConfig,
    visionConfig: ApiConfig | null,
    persona: PersonaConfig,
    conversationId: string,
    callbacks: MessageEngineCallbacks
  ) {
    this.llmClient = new LLMClient(llmConfig);
    this.visionClient = new VisionClient(visionConfig);
    this.pauseScheduler = new PauseScheduler();
    this.activeMemory = new ActiveMemory(conversationId);
    this.summaryWorker = new SummaryWorker(conversationId, llmConfig);
    this.persona = persona;
    this.callbacks = callbacks;
  }

  cancel(): void {
    this.cancelled = true;
  }

  setMediaState(state: MediaState): void {
    this.mediaState = state;
  }

  async processTextMessage(userInput: string): Promise<void> {
    this.cancelled = false;
    try {
      this.callbacks.onTypingStart();

      await this.summaryWorker.checkAndCompress();
      if (this.cancelled) return;

      let systemPrompt = PromptBuilder.buildSystemPrompt(this.persona, this.mediaState);
      const activeMessages = await this.activeMemory.getRecent();
      const longTermMemory = await this.activeMemory.getLongTermMemory();

      // Inject recent call event hint into system prompt (not as user message)
      const recentSystemMsgs = await this.activeMemory.getRecentSystemMessages();
      const callHint = PromptBuilder.buildCallEventHint(recentSystemMsgs);
      if (callHint) systemPrompt += callHint;

      // Inject recent Space activity so character knows about user's posts
      try {
        const feed = await SocialRepo.getFeed(5);
        const userPosts = feed
          .filter((p: any) => p.author_id === 'user')
          .map((p: any) => ({ content: p.content_text, created_at: p.created_at }));
        const userComments = feed
          .flatMap((p: any) => p.comments.filter((c: any) => c.author_id === 'user'))
          .slice(0, 5)
          .map((c: any) => ({ content: c.content, created_at: c.created_at }));
        const spaceHint = PromptBuilder.buildSpaceActivityHint(userPosts, userComments);
        if (spaceHint) systemPrompt += spaceHint;
      } catch {}

      const messages = PromptBuilder.buildMessages(
        systemPrompt, longTermMemory, activeMessages, userInput
      );

      const rawResponse = await this.llmClient.chat(messages);
      if (this.cancelled) return;

      const structured = ResponseParser.parse(rawResponse);
      const queue = this.pauseScheduler.buildQueue(structured);

      this.callbacks.onTypingEnd();
      await this.deliverQueue(queue);
    } catch (error) {
      if (!this.cancelled) {
        this.callbacks.onTypingEnd();
        this.callbacks.onError(error as Error);
      }
    }
  }

  async processImageMessage(imageBase64: string, userCaption?: string): Promise<void> {
    this.cancelled = false;
    try {
      this.callbacks.onTypingStart();

      let imageContext = '';
      if (this.visionClient.isConfigured()) {
        imageContext = await this.visionClient.analyze(imageBase64);
      }
      if (this.cancelled) return;

      await this.summaryWorker.checkAndCompress();

      const systemPrompt = PromptBuilder.buildSystemPrompt(this.persona, this.mediaState);
      const activeMessages = await this.activeMemory.getRecent();
      const longTermMemory = await this.activeMemory.getLongTermMemory();

      const messages = PromptBuilder.buildMessages(
        systemPrompt, longTermMemory, activeMessages,
        userCaption || '你觉得这张图片怎么样？', imageContext
      );

      const rawResponse = await this.llmClient.chat(messages);
      if (this.cancelled) return;

      const structured = ResponseParser.parse(rawResponse);
      const queue = this.pauseScheduler.buildQueue(structured);

      this.callbacks.onTypingEnd();
      await this.deliverQueue(queue);
    } catch (error) {
      if (!this.cancelled) {
        this.callbacks.onTypingEnd();
        this.callbacks.onError(error as Error);
      }
    }
  }

  /**
   * Deliver queued messages with emotional pauses.
   * Typing indicator stays on between messages (no flicker).
   */
  private async deliverQueue(queue: QueuedMessage[]): Promise<void> {
    // Show typing once, keep it on throughout delivery
    this.callbacks.onTypingStart();

    for (let i = 0; i < queue.length; i++) {
      if (this.cancelled) break;

      const msg = queue[i];

      // Pause between messages (skip for first)
      if (i > 0) {
        await this.sleep(msg.delayMs);
        if (this.cancelled) break;
      }

      // Deliver message — await to ensure sequential TTS + rendering order
      await this.callbacks.onQueuedMessage(msg);
    }

    // Turn off typing after all messages delivered
    this.callbacks.onTypingEnd();
    if (!this.cancelled) {
      this.callbacks.onAllMessagesSent();
    }
  }

  async generateProactiveMessage(): Promise<void> {
    try {
      const systemPrompt = PromptBuilder.buildSystemPrompt(this.persona, this.mediaState);
      const activeMessages = await this.activeMemory.getRecent();
      const longTermMemory = await this.activeMemory.getLongTermMemory();

      const proactivePrompt =
        '现在对方有一段时间没说话了。请根据你们的关系和最近的对话，自然地发一条消息关心对方或分享你的日常。保持简短自然。';

      const messages = PromptBuilder.buildMessages(
        systemPrompt, longTermMemory, activeMessages, proactivePrompt
      );

      const rawResponse = await this.llmClient.chat(messages);
      if (this.cancelled) return;

      const structured = ResponseParser.parse(rawResponse);
      const queue = this.pauseScheduler.buildQueue(structured);

      this.callbacks.onTypingStart();
      await this.deliverQueue(queue);
    } catch {
      // Silent fail for proactive messages
    }
  }

  updateLLMConfig(config: ApiConfig): void {
    this.llmClient.updateConfig(config);
  }

  updateVisionConfig(config: ApiConfig | null): void {
    this.visionClient.updateConfig(config);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) { resolved = true; clearInterval(check); resolve(); }
      }, ms);
      const check = setInterval(() => {
        if (this.cancelled && !resolved) {
          resolved = true;
          clearTimeout(timer);
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }
}
