/**
 * Curoco — Global Voice Store
 * Manages cloned voices in app_settings, shared across all companions
 */

import { SettingsRepository } from '../db/repositories/SettingsRepository';

export interface ClonedVoice {
  id: string;
  name: string;
  voiceId: string;
  createdAt: string;
}

const VOICE_KEY = 'cloned_voices';

export const VoiceStore = {
  async getAll(): Promise<ClonedVoice[]> {
    try {
      const data = await SettingsRepository.getSetting(VOICE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async save(voices: ClonedVoice[]): Promise<void> {
    await SettingsRepository.setSetting(VOICE_KEY, JSON.stringify(voices));
  },

  async add(voice: ClonedVoice): Promise<ClonedVoice[]> {
    const voices = await this.getAll();
    voices.unshift(voice);
    await this.save(voices);
    return voices;
  },

  async remove(id: string): Promise<ClonedVoice[]> {
    const voices = (await this.getAll()).filter((v) => v.id !== id);
    await this.save(voices);
    return voices;
  },
};
