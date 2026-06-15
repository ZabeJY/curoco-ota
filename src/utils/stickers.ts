/**
 * Curoco — Built-in Sticker Packs
 * Emoji-based stickers that work without image files
 */

export interface StickerPack {
  id: string;
  name: string;
  stickers: Sticker[];
}

export interface Sticker {
  id: string;
  emoji: string;
  label: string;
}

export const BUILTIN_STICKER_PACKS: StickerPack[] = [
  {
    id: 'emotions',
    name: '表情',
    stickers: [
      { id: 'happy', emoji: '😊', label: '开心' },
      { id: 'love', emoji: '😍', label: '喜欢' },
      { id: 'laugh', emoji: '🤣', label: '大笑' },
      { id: 'cry', emoji: '😢', label: '哭' },
      { id: 'angry', emoji: '😤', label: '生气' },
      { id: 'shy', emoji: '😳', label: '害羞' },
      { id: 'cool', emoji: '😎', label: '酷' },
      { id: 'think', emoji: '🤔', label: '思考' },
      { id: 'surprised', emoji: '😱', label: '惊讶' },
      { id: 'sleepy', emoji: '😴', label: '困' },
      { id: 'sad', emoji: '😞', label: '难过' },
      { id: 'nervous', emoji: '😰', label: '紧张' },
    ],
  },
  {
    id: 'gestures',
    name: '手势',
    stickers: [
      { id: 'wave', emoji: '👋', label: '挥手' },
      { id: 'thumbsup', emoji: '👍', label: '赞' },
      { id: 'thumbsdown', emoji: '👎', label: '踩' },
      { id: 'clap', emoji: '👏', label: '鼓掌' },
      { id: 'ok', emoji: '👌', label: 'OK' },
      { id: 'peace', emoji: '✌️', label: '耶' },
      { id: 'fist', emoji: '✊', label: '拳头' },
      { id: 'pray', emoji: '🙏', label: '拜托' },
      { id: 'hug', emoji: '🤗', label: '抱抱' },
      { id: 'highfive', emoji: '🖐️', label: '击掌' },
    ],
  },
  {
    id: 'hearts',
    name: '爱心',
    stickers: [
      { id: 'heart', emoji: '❤️', label: '红心' },
      { id: 'heart_eyes', emoji: '💕', label: '爱心眼' },
      { id: 'broken_heart', emoji: '💔', label: '心碎' },
      { id: 'sparkling_heart', emoji: '💖', label: '闪亮心' },
      { id: 'growing_heart', emoji: '💗', label: '跳动心' },
      { id: 'two_hearts', emoji: '💞', label: '双心' },
      { id: 'revolving_hearts', emoji: '💝', label: '礼物心' },
      { id: 'heartbeat', emoji: '💓', label: '心跳' },
    ],
  },
  {
    id: 'animals',
    name: '动物',
    stickers: [
      { id: 'cat', emoji: '🐱', label: '猫' },
      { id: 'dog', emoji: '🐶', label: '狗' },
      { id: 'bear', emoji: '🐻', label: '熊' },
      { id: 'bunny', emoji: '🐰', label: '兔子' },
      { id: 'fox', emoji: '🦊', label: '狐狸' },
      { id: 'panda', emoji: '🐼', label: '熊猫' },
      { id: 'koala', emoji: '🐨', label: '考拉' },
      { id: 'lion', emoji: '🦁', label: '狮子' },
      { id: 'penguin', emoji: '🐧', label: '企鹅' },
      { id: 'hamster', emoji: '🐹', label: '仓鼠' },
    ],
  },
  {
    id: 'food',
    name: '美食',
    stickers: [
      { id: 'cake', emoji: '🍰', label: '蛋糕' },
      { id: 'cookie', emoji: '🍪', label: '饼干' },
      { id: 'coffee', emoji: '☕', label: '咖啡' },
      { id: 'bubble_tea', emoji: '🧋', label: '奶茶' },
      { id: 'ice_cream', emoji: '🍦', label: '冰淇淋' },
      { id: 'candy', emoji: '🍬', label: '糖果' },
      { id: 'chocolate', emoji: '🍫', label: '巧克力' },
      { id: 'strawberry', emoji: '🍓', label: '草莓' },
    ],
  },
];

// Custom stickers stored by user
export interface CustomSticker {
  id: string;
  uri: string;
  label: string;
}
