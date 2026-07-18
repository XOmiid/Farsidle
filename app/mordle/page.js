import DuelGame from "@/components/duel/DuelGame";

export const metadata = {
  title: "موردل",
  description: "هر روز ۵ سوال — کدوم عدد بزرگ‌تره؟",
  alternates: { canonical: "/mordle" },
};

export default function MordlePage() {
  return <DuelGame />;
}