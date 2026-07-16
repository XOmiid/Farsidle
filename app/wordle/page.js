import WordleGame from "@/components/wordle/WordleGame";

export const metadata = {
  title: "وردل فارسی",
  description: "یک کلمه‌ی فارسی جدید هر روز — حدس بزن در ۶ تلاش.",
  alternates: { canonical: "/wordle" },
};

export default function WordlePage() {
  return <WordleGame />;
}