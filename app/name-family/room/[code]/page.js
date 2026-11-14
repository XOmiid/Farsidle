import Room from '@/components/name-family/Room';
export const metadata = { title: 'اتاق اسم و فامیل', robots: { index: false, follow: false } };
export default async function Page({ params }) {
  const { code } = await params;
  return <Room code={code} />;
}
