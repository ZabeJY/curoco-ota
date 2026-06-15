/**
 * Curoco — Settings Repository
 * CRUD for API configs and app settings (KV store)
 */

import { getDatabase } from '../index';
import type { ApiConfig, ApiProviderType, AppSettings } from '../../types/models';
import { DEFAULT_APP_SETTINGS } from '../../types/models';

/**
 * Generate a UUID with fallback for environments without crypto
 */
function generateId(): string {
  try {
    const { v4 } = require('uuid');
    return v4();
  } catch {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
}

function rowToApiConfig(row: any): ApiConfig {
  return {
    id: row.id,
    providerType: row.provider_type as ApiProviderType,
    label: row.label,
    baseUrl: row.base_url,
    apiKey: row.api_key,
    modelName: row.model_name,
    isActive: row.is_active === 1,
    extraHeaders: row.extra_headers ? JSON.parse(row.extra_headers) : null,
    createdAt: row.created_at,
  };
}

export const SettingsRepository = {
  async getApiConfigs(providerType?: ApiProviderType): Promise<ApiConfig[]> {
    const db = await getDatabase();
    let query = 'SELECT * FROM api_configs';
    const params: any[] = [];

    if (providerType) {
      query += ' WHERE provider_type = ?';
      params.push(providerType);
    }

    query += ' ORDER BY created_at DESC';
    const rows = await db.getAllAsync(query, params);
    return rows.map(rowToApiConfig);
  },

  async getActiveApiConfig(providerType: ApiProviderType): Promise<ApiConfig | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync(
      'SELECT * FROM api_configs WHERE provider_type = ? AND is_active = 1 LIMIT 1',
      [providerType]
    );
    return row ? rowToApiConfig(row) : null;
  },

  async createApiConfig(data: Omit<ApiConfig, 'id' | 'createdAt'>): Promise<ApiConfig> {
    const db = await getDatabase();
    const id = generateId();

    // If setting as active, deactivate others of same type
    if (data.isActive) {
      await db.runAsync(
        'UPDATE api_configs SET is_active = 0 WHERE provider_type = ?',
        [data.providerType]
      );
    }

    await db.runAsync(
      `INSERT INTO api_configs (id, provider_type, label, base_url, api_key, model_name, is_active, extra_headers, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id, data.providerType, data.label, data.baseUrl, data.apiKey,
        data.modelName, data.isActive ? 1 : 0,
        data.extraHeaders ? JSON.stringify(data.extraHeaders) : null,
      ]
    );

    const row = await db.getFirstAsync('SELECT * FROM api_configs WHERE id = ?', [id]);
    return rowToApiConfig(row);
  },

  async setActiveApiConfig(id: string, providerType: ApiProviderType): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE api_configs SET is_active = 0 WHERE provider_type = ?',
      [providerType]
    );
    await db.runAsync('UPDATE api_configs SET is_active = 1 WHERE id = ?', [id]);
  },

  async deleteApiConfig(id: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM api_configs WHERE id = ?', [id]);
  },

  async getSettings(): Promise<AppSettings> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ key: string; value: string }>(
      'SELECT key, value FROM app_settings WHERE key NOT LIKE ?',
      ['db_%']
    );

    const settings = { ...DEFAULT_APP_SETTINGS };
    for (const row of rows) {
      const key = row.key as keyof AppSettings;
      if (key in settings) {
        const val = row.value;
        if (typeof settings[key] === 'number') {
          (settings as any)[key] = parseInt(val, 10);
        } else if (typeof settings[key] === 'boolean') {
          (settings as any)[key] = val === 'true';
        } else {
          (settings as any)[key] = val;
        }
      }
    }

    return settings;
  },

  async getSetting(key: string): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [key]
    );
    return row ? row.value : null;
  },

  async setSetting(key: string, value: string | number | boolean): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
      [key, String(value)]
    );
  },
};
