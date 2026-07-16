import FactleGame from "@/components/factle/FactleGame";

export const metadata = {
  title: "فکتل",
  description: "هر روز یک کشور — از روی سرنخ‌ها حدس بزن، در ۶ تلاش.",
  alternates: { canonical: "/factle" },
};

export default function FactlePage() {
  return <FactleGame />;
}