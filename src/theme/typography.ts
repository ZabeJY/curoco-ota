/**
 * Curoco — Typography System
 */

import { Platform } from 'react-native';

const fontFamily = Platform.select({
  ios: 'PingFang SC',
  android: 'Noto Sans CJK SC',
  default: 'System',
});

export const WeChatTypography = {
  fontFamily,
  chatBubble: { fontSize: 15, lineHeight: 22, fontFamily },
  chatInput: { fontSize: 15, lineHeight: 22, fontFamily },
  conversationTitle: { fontSize: 16, fontWeight: '600' as const, fontFamily, lineHeight: 22 },
  conversationPreview: { fontSize: 13, fontFamily, lineHeight: 18 },
  timestamp: { fontSize: 11, fontFamily },
  tabLabel: { fontSize: 10, fontWeight: '500' as const, fontFamily },
} as const;
