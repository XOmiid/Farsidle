import CrosswordPlayer from "@/components/crossword/CrosswordPlayer";

export const metadata = {
  title: "مینی جدول",
};

export default async function CrosswordPlayerPage({ params }) {
  const { id } = await params;
  return <CrosswordPlayer id={id} />;
}