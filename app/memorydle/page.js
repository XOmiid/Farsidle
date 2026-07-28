import MemorydleGame from "@/components/memorydle/MemorydleGame";

export const metadata = {
  title: "مموریدل",
  description: "۵ عدد رو به خاطر بسپار، بعد از بین ۱۵ عدد پیداشون کن.",
  alternates: { canonical: "/memorydle" },
};

export default function MemorydlePage() {
  return <MemorydleGame />;
}