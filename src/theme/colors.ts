/**
 * Curoco — Modern Design System Colors
 * Glassmorphism + Morandi palette + Dark mode support
 */

// ── Morandi-inspired palette ──
const morandi = {
  // Chat bubbles - soft, muted tones
  mistBlue: '#D6E4F0',
  mistBlueDark: '#1E2A3A',
  creamBeige: '#F5EDE3',
  creamBeigeDark: '#2A2520',
  warmGray: '#E8E4E0',
  warmGrayDark: '#1C1C1E',
  softRose: '#F0DDE0',
  softRoseDark: '#3A1E24',
  lavender: '#E4DCF0',
  lavenderDark: '#2A1E3A',
  sage: '#D8E8D8',
  sageDark: '#1E2A1E',
  peach: '#F5E0D0',
  peachDark: '#3A2A1E',
} as const;

// ── Light Theme ──
export const LightTheme = {
  // Primary accent
  primary: '#6C63FF',
  primaryLight: 'rgba(108, 99, 255, 0.12)',
  primaryDark: '#5A52E0',

  // Backgrounds - layered
  bgPrimary: '#F8F7FC',
  bgSecondary: '#FFFFFF',
  bgTertiary: '#F0EFF5',
  bgCard: 'rgba(255, 255, 255, 0.72)',
  bgGlass: 'rgba(255, 255, 255, 0.6)',
  bgInput: '#F5F4FA',

  // Chat bubbles - Morandi
  bubbleSelf: morandi.mistBlue,
  bubbleOther: '#FFFFFF',
  bubbleSystem: '#EDEDF5',

  // Text hierarchy
  textPrimary: '#1A1A2E',
  textSecondary: '#6B6B8D',
  textTertiary: '#A0A0B8',
  textInverse: '#FFFFFF',
  textLink: '#6C63FF',
  textSelf: '#1A1A2E',

  // Borders
  border: '#E8E8F0',
  divider: '#F0F0F8',

  // Status
  danger: '#FF4757',
  warning: '#FFA502',
  success: '#2ED573',
  info: '#3742FA',

  // Tab bar
  tabActive: '#6C63FF',
  tabInactive: '#A0A0B8',

  // Overlays
  overlay: 'rgba(26, 26, 46, 0.5)',
  mask: 'rgba(26, 26, 46, 0.2)',

  // Avatar
  avatarColors: ['#FF6B6B', '#FFA94D', '#FFD43B', '#69DB7C', '#4DABF7', '#9775FA', '#F783AC'],

  // Morandi tones for variety
  morandi,
} as const;

// ── Dark Theme ──
export const DarkTheme = {
  primary: '#8B83FF',
  primaryLight: 'rgba(139, 131, 255, 0.2)',
  primaryDark: '#7B73E0',

  bgPrimary: '#0D0D14',
  bgSecondary: '#161622',
  bgTertiary: '#1E1E2E',
  bgCard: 'rgba(30, 30, 46, 0.8)',
  bgGlass: 'rgba(30, 30, 46, 0.6)',
  bgInput: '#1E1E2E',

  bubbleSelf: morandi.mistBlueDark,
  bubbleOther: '#1E1E2E',
  bubbleSystem: '#252536',

  textPrimary: '#E8E8F0',
  textSecondary: '#8888A8',
  textTertiary: '#5A5A78',
  textInverse: '#1A1A2E',
  textLink: '#8B83FF',
  textSelf: '#E8E8F0',

  border: '#2A2A3E',
  divider: '#1E1E2E',

  danger: '#FF6B6B',
  warning: '#FFB347',
  success: '#51CF66',
  info: '#5C7CFA',

  tabActive: '#8B83FF',
  tabInactive: '#5A5A78',

  overlay: 'rgba(0, 0, 0, 0.6)',
  mask: 'rgba(0, 0, 0, 0.3)',

  avatarColors: ['#FF6B6B', '#FFA94D', '#FFD43B', '#69DB7C', '#4DABF7', '#9775FA', '#F783AC'],

  morandi,
} as const;

export type Theme = typeof LightTheme | typeof DarkTheme;
export const EmotionColors: Record<string, string> = {
  happy: '#FFD700', sad: '#6495ED', shy: '#FF69B4', excited: '#FF4500',
  angry: '#DC143C', thinking: '#9370DB', neutral: '#808080',
  surprised: '#FFA500', worried: '#708090', playful: '#FF69B4',
};

// Default export for backward compatibility
export const WeChatColors = LightTheme;
