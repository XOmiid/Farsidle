import StorePage from "@/components/store/StorePage";

export const metadata = {
  title: "فروشگاه",
  description: "با سکه‌هایی که از بازی‌ها جمع می‌کنی جوایز واقعی بگیر",
  alternates: { canonical: "/store" },
};

export default function StoreRoute() {
  return <StorePage />;
}