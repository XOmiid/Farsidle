import { Auth } from '@/components/arcade/Account';
export default async function Page({ searchParams }) {
  const query = await searchParams;
  return <Auth mode="register" returnTo={query?.next} />;
}
