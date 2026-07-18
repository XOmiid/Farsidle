import ColordleGame from "@/components/colordle/ColordleGame";

export const metadata = {
  title: "رنگدل",
  description: "هر روز اسم یک رنگ — با اسلایدرهای قرمز، سبز و آبی همون رنگ رو بساز.",
  alternates: { canonical: "/colordle" },
};

export default function ColordlePage() {
  return <ColordleGame />;
}
