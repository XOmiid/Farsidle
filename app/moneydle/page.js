import MoneydleGame from "@/components/moneydle/MoneydleGame";

export const metadata = {
  title: "پولدل",
  description: "هر روز ۵ ارز — از باارزش‌ترین به کم‌ارزش‌ترین مرتبشون کن.",
  alternates: { canonical: "/moneydle" },
};

export default function MoneydlePage() {
  return <MoneydleGame />;
}
