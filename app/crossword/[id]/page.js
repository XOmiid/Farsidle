import CrosswordPlayer from "@/components/crossword/CrosswordPlayer";

export const metadata = {
  title: "مینی جدول",
};

export default function CrosswordPlayerPage({ params }) {
  return <CrosswordPlayer id={params.id} />;
}