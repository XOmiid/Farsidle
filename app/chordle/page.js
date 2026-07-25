import ChordleGame from "@/components/chordle/ChordleGame";

export const metadata = {
  title: "کوردل",
  description: "هر روز نت‌های پیانو رو بشنو و ترتیبشو درست بساز.",
  alternates: { canonical: "/chordle" },
};

export default function ChordlePage() {
  return <ChordleGame />;
}