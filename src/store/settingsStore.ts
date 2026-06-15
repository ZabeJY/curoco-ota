/**
 * Curoco — Settings Store (Zustand)
 */

import { create } from 'zustand';
import type { ApiConfig, ApiProviderType, AppSettings } from '../types/models';
import { DEFAULT_APP_SETTINGS } from '../types/models';
import { SettingsRepository } from '../db/repositories/SettingsRepository';

interface SettingsState {
  settings: AppSettings;
  apiConfigs: Record<ApiProviderType, ApiConfig | null>;
  isLoading: boolean;

  loadSettings: () => Promise<void>;
  loadApiConfigs: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  saveApiConfig: (config: Omit<ApiConfig, 'id' | 'createdAt'>) => Promise<{ success: boolean; error?: string }>;
  setActiveConfig: (id: string, providerType: ApiProviderType) => Promise<void>;
  deleteApiConfig: (id: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_APP_SETTINGS,
  apiConfigs: { llm: null, vision: null, asr: null, tts: null },
  isLoading: false,

  loadSettings: async () => {
    try {
      const settings = await SettingsRepository.getSettings();
      set({ settings });
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  },

  loadApiConfigs: async () => {
    set({ isLoading: true });
    try {
      const [llm, vision, asr, tts] = await Promise.all([
        SettingsRepository.getActiveApiConfig('llm'),
        SettingsRepository.getActiveApiConfig('vision'),
        SettingsRepository.getActiveApiConfig('asr'),
        SettingsRepository.getActiveApiConfig('tts'),
      ]);
      set({ apiConfigs: { llm, vision, asr, tts } });
    } catch (e) {
      console.warn('Failed to load API configs:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  updateSetting: async (key, value) => {
    try {
      await SettingsRepository.setSetting(key, value);
      set((state) => ({
        settings: { ...state.settings, [key]: value },
      }));
    } catch (e) {
      console.warn('Failed to update setting:', e);
    }
  },

  saveApiConfig: async (config) => {
    try {
      await SettingsRepository.createApiConfig(config);
      const active = await SettingsRepository.getActiveApiConfig(config.providerType);
      set((state) => ({
        apiConfigs: { ...state.apiConfigs, [config.providerType]: active },
      }));
      return { success: true };
    } catch (e: any) {
      console.error('Failed to save API config:', e);
      return { success: false, error: e?.message || '保存失败，请重试' };
    }
  },

  setActiveConfig: async (id, providerType) => {
    try {
      await SettingsRepository.setActiveApiConfig(id, providerType);
      const active = await SettingsRepository.getActiveApiConfig(providerType);
      set((state) => ({
        apiConfigs: { ...state.apiConfigs, [providerType]: active },
      }));
    } catch (e) {
      console.warn('Failed to set active config:', e);
    }
  },

  deleteApiConfig: async (id) => {
    try {
      await SettingsRepository.deleteApiConfig(id);
      const configs = await SettingsRepository.getApiConfigs();
      const newApiConfigs: Record<ApiProviderType, ApiConfig | null> = {
        llm: null, vision: null, asr: null, tts: null,
      };
      for (const c of configs) {
        if (c.isActive) newApiConfigs[c.providerType] = c;
      }
      set({ apiConfigs: newApiConfigs });
    } catch (e) {
      console.warn('Failed to delete API config:', e);
    }
  },
}));
