import PricedleGame from "@/components/pricedle/PricedleGame";

export const metadata = {
  title: "قیمتدل",
  description: "قیمت چیزهای مختلف در ایران در سال‌های گذشته رو حدس بزن.",
  alternates: { canonical: "/pricedle" },
};

export default function PricedlePage() {
  return <PricedleGame />;
}