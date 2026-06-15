/**
 * Curoco — Persona Engine
 * Loads and manages persona configurations
 */

import { CompanionRepository } from '../../db/repositories/CompanionRepository';
import type { Companion } from '../../types/models';
import type { PersonaConfig } from '../../types/persona';

export class PersonaEngine {
  /**
   * Convert a Companion DB record to PersonaConfig
   */
  static fromCompanion(companion: Companion, userSignature: string = ''): PersonaConfig {
    return {
      companionId: companion.id,
      name: companion.name,
      gender: companion.gender,
      age: companion.age,
      relationship: companion.relationship,
      nicknameForUser: companion.nicknameForUser,
      personality: companion.personality,
      backstory: companion.backstory,
      worldSetting: companion.worldSetting,
      voiceEnabled: companion.voiceEnabled,
      proactiveMessageEnabled: companion.proactiveMessageEnabled,
      ttsVoiceId: companion.ttsVoiceId,
      speakingStyle: companion.speakingStyle || '',
      tabooTopics: companion.tabooTopics || '',
      likes: companion.likes || '',
      catchphrase: companion.catchphrase || '',
      emotionStyle: companion.emotionStyle || '',
      userSignature,
    };
  }

  /**
   * Load persona config by companion ID
   */
  static async load(companionId: string, userSignature: string = ''): Promise<PersonaConfig | null> {
    const companion = await CompanionRepository.getById(companionId);
    if (!companion) return null;
    return PersonaEngine.fromCompanion(companion, userSignature);
  }

  /**
   * Get default persona for quick start
   */
  static getDefault(): PersonaConfig {
    return {
      companionId: 'default',
      name: '小助手',
      gender: 'female',
      age: 22,
      relationship: '好朋友',
      nicknameForUser: '你',
      personality: '温柔体贴，善解人意，偶尔会撒娇',
      backstory: '一个温暖的角色，总是陪伴在你身边',
      worldSetting: '',
      voiceEnabled: false,
      proactiveMessageEnabled: false,
      ttsVoiceId: null,
      speakingStyle: '',
      tabooTopics: '',
      likes: '',
      catchphrase: '',
      emotionStyle: '',
      userSignature: '',
    };
  }
}
