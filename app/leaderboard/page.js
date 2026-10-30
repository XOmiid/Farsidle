import Leaderboard from '@/components/arcade/Leaderboard';
export const metadata = { title: 'برترین‌ها', robots: { index: false } };
export default async function Page({ searchParams }) {
  const { game } = await searchParams;
  return <Leaderboard initialGame={game} />;
}
