import GoldleGame from "@/components/goldle/GoldleGame";

export const metadata = {
  title: "طلادل",
  description: "با ۱۰۰ طلا شروع کن، رو جواب درست شرط ببند، ۵ سوال تا آخر برو.",
  alternates: { canonical: "/goldle" },
};

export default function GoldlePage() {
  return <GoldleGame />;
}
