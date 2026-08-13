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
    tagline: 'یک رنگ ، با اسلایدرها بسازش ، هر روز ساعت ۹ شب',
    icon: '🎨',
    status: 'live',
  },
  {
    slug: 'chordle',
    href: '/chordle',
    title: 'کوردل',
    tagline: 'نت‌های پیانو رو بشنو و ترتیبشو درست بساز، هر روز ساعت ۹ شب',
    icon: '🎹',
    status: 'live',
  },
  {
    slug: 'memorydle',
    href: '/memorydle',
    title: 'مموریدل',
    tagline: '۵ عدد رو به خاطر بسپار، از بین ۱۵ پیداشون کن، هر روز ساعت ۹ شب',
    icon: '🧠',
    status: 'live',
  },
  {
    slug: 'teamdle',
    href: '/teamdle',
    title: 'تیمدل',
    tagline: 'هر روز در مقابل تیم مقابل بازی کن — پایتخت‌ها رو بشناس',
    icon: '🌍',
    status: 'live',
  },
  {
    slug: 'crossword',
    href: '/crossword',
    title: 'مینی جدول',
    tagline: 'جدول‌های کلمات فارسی — باز کن و حل کن',
    icon: '🔠',
    status: 'live',
  },
];