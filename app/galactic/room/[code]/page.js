import Room from '@/components/galactic/Room';
export const metadata = { title: 'اتاق کهکشانی', robots: { index: false, follow: false } };
export default async function Page({ params }) {
  const { code } = await params;
  return <Room code={code} />;
}
