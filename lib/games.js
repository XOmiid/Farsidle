// Add a new entry here whenever a new game ships. The hub page and the
// sidebar both read from this list, so nothing else needs to change.
export const games = [
  {
    slug: 'wordle',
    href: '/wordle',
    title: 'وردل فارسی',
    tagline: 'یک کلمه، شش تلاش، هر روز ساعت ۹ شب',
    icon: '🟩',
    status: 'live', // 'live' | 'soon'
  },
  {
    slug: 'factle',
    href: '/factle',
    title: 'فکتل',
    tagline: 'یک کشور ، شش سرنخ، هر روز ساعت ۹ شب',
    icon: '🌍',
    status: 'live',
  },
  {
    slug: 'colordle',
    href: '/colordle',
    title: 'رنگدل',
    tagline: 'یک رنگ ، با اسلایدرها بسازش، هر روز ساعت ۹ شب',
    icon: '🎨',
    status: 'live',
  },
  {
    slug: 'mordle',
    href: '/mordle',
    title: 'موردل',
    tagline: 'هر روز ۵ سوال، کدوم عدد بزرگ‌تره؟ هر روز ساعت ۹ شب',
    icon: '⚖️',
    status: 'live',
  },
  {
    slug: 'moneydle',
    href: '/moneydle',
    title: 'پولدل',
    tagline: 'هر روز ۵ ارز، از باارزش تا کم‌ارزش مرتبشون کن، هر روز ساعت ۹ شب',
    icon: '💰',
    status: 'live',
  },
  {
    slug: 'coming-soon-1',
    href: null,
    title: 'مینی جدول',
    tagline: 'به‌زودی...',
    icon: '🎲',
    status: 'soon',
  },
];