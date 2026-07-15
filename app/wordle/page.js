import WordleGame from "@/components/wordle/WordleGame";

export const metadata = {
  title: "وردل فارسی | فارسیدل",
  description: "یک کلمه‌ی فارسی جدید هر روز — حدس بزن در ۶ تلاش.",
};

export default function WordlePage() {
  return <WordleGame />;
}
