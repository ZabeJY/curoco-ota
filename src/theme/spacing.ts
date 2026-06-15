/**
 * Curoco — Spacing & Layout System
 */

export const WeChatSpacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,

  // Chat bubble - natural text wrapping
  bubblePaddingH: 14,
  bubblePaddingV: 10,
  bubbleRadius: 20,
  bubbleMaxWidth: 0.72,
  bubbleGap: 4,
  bubbleMinWidth: 48,

  // Chat input
  inputBarHeight: 56,
  inputBarPadding: 10,
  inputRadius: 24,
  inputIconSize: 24,

  // List items
  listItemHeight: 72,
  listItemPaddingH: 16,
  listItemPaddingV: 14,

  // Avatar
  avatarSm: 36,
  avatarMd: 44,
  avatarLg: 60,
  avatarXL: 80,

  // Tab bar
  tabBarHeight: 60,
  tabIconSize: 22,

  // Header
  headerHeight: 48,

  // Border radius
  radiusSm: 10,
  radiusMd: 14,
  radiusLg: 20,
  radiusXL: 28,
  radiusFull: 9999,
} as const;

export const WeChatShadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  glow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
} as const;
