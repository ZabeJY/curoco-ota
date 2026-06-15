/**
 * Curoco — Sticker Search Client
 * Uses Tenor API (Google) for network sticker search
 * Free tier: https://developers.google.com/tenor/guides/quickstart
 */

const TENOR_BASE = 'https://tenor.googleapis.com/v2';
// Register free API key at: https://console.developers.google.com/
// Enable "Tenor API" in the project, then create credentials → API key
const TENOR_KEY = 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ';

export interface NetworkSticker {
  id: string;
  url: string;        // preview URL (small, for display)
  fullUrl: string;    // full-size URL (for sending)
  title: string;
  width: number;
  height: number;
}

export const StickerSearchClient = {
  async search(query: string, limit: number = 20, pos: string = ''): Promise<NetworkSticker[]> {
    if (!query.trim()) return [];
    try {
      let url = `${TENOR_BASE}/search?key=${TENOR_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&media_filter=gif,tinygif,mediumgif&contentfilter=low`;
      if (pos) url += `&pos=${pos}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Tenor error: ${res.status}`);
      const data = await res.json();
      return (data.results || []).map((item: any) => ({
        id: item.id,
        url: item.media_formats?.tinygif?.url || item.media_formats?.gif?.url || '',
        fullUrl: item.media_formats?.mediumgif?.url || item.media_formats?.gif?.url || '',
        title: item.title || item.content_description || '',
        width: item.media_formats?.tinygif?.dims?.[0] || 120,
        height: item.media_formats?.tinygif?.dims?.[1] || 120,
      })).filter((s: NetworkSticker) => s.url);
    } catch (e) {
      console.warn('Sticker search failed:', e);
      return [];
    }
  },

  async trending(limit: number = 20, pos: string = ''): Promise<NetworkSticker[]> {
    try {
      let url = `${TENOR_BASE}/featured?key=${TENOR_KEY}&limit=${limit}&media_filter=gif,tinygif,mediumgif&contentfilter=low`;
      if (pos) url += `&pos=${pos}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Tenor error: ${res.status}`);
      const data = await res.json();
      return (data.results || []).map((item: any) => ({
        id: item.id,
        url: item.media_formats?.tinygif?.url || item.media_formats?.gif?.url || '',
        fullUrl: item.media_formats?.mediumgif?.url || item.media_formats?.gif?.url || '',
        title: item.title || item.content_description || '',
        width: item.media_formats?.tinygif?.dims?.[0] || 120,
        height: item.media_formats?.tinygif?.dims?.[1] || 120,
      })).filter((s: NetworkSticker) => s.url);
    } catch (e) {
      console.warn('Sticker trending failed:', e);
      return [];
    }
  },
};
