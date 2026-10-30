import { notFound } from 'next/navigation';
import Game from '@/components/arcade/Game';
import { GAMES, gameById } from '@/lib/classic/catalog';
export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.id }));
}
export async function generateMetadata({ params }) {
  const { game } = await params;
  const meta = gameById(game);
  return {
    title: meta?.name || 'بازی',
    description: meta?.description,
    alternates: { canonical: '/classic/' + game },
  };
}
export default async function Page({ params, searchParams }) {
  const { game } = await params;
  const query = await searchParams;
  if (!gameById(game)) notFound();
  return <Game game={game} id={query.id || null} />;
}
