import { GAMES } from '@/lib/classic/catalog';
export default function sitemap() {
  return ['', '/classic', '/galactic', ...GAMES.map((g) => '/classic/' + g.id)].map((path) => ({
    url: 'https://farsidle.com' + path,
    changeFrequency: 'daily',
    priority: path === '' ? 1 : 0.8,
  }));
}
