import TeamdleGame from "@/components/teamdle/TeamdleGame";

export const metadata = {
  title: "تیمدل",
  description: "هر روز در مقابل تیم مقابل بازی کن. پایتخت‌ها رو بشناس!",
  alternates: { canonical: "/teamdle" },
};

export default function TeamdlePage() {
  return <TeamdleGame />;
}