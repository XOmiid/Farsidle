import CrosswordList from "@/components/crossword/CrosswordList";

export const metadata = {
  title: "مینی جدول",
  description: "جدول‌های کلمات فارسی — باز کن و حل کن",
  alternates: { canonical: "/crossword" },
};

export default function CrosswordPage() {
  return <CrosswordList />;
}