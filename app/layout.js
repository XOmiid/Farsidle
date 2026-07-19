import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  metadataBase: new URL("https://farsidle.com"),
  title: {
    default: "فارسیدل | Farsidle — بازی‌های کلمه‌ای فارسی",
    template: "%s | فارسیدل",
  },
  description:
    "خانه‌ی بازی‌های کلمه‌ای روزانه‌ی فارسی. وردل فارسی و فکتل رو هر روز رایگان بازی کن و با بقیه رقابت کن.",
  keywords: ["وردل فارسی", "فارسیدل", "بازی کلمه فارسی", "فکتل", "wordle farsi", "بازی آنلاین فارسی"],
  authors: [{ name: "Farsidle" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "fa_IR",
    url: "https://farsidle.com",
    siteName: "فارسیدل",
    title: "فارسیدل | بازی‌های کلمه‌ای فارسی",
    description: "یک کلمه‌ی فارسی جدید هر روز. حدس بزن، رقابت کن، تو جدول برترین‌ها بمون.",
  },
  twitter: {
    card: "summary",
    title: "فارسیدل | بازی‌های کلمه‌ای فارسی",
    description: "یک کلمه‌ی فارسی جدید هر روز. حدس بزن، رقابت کن، تو جدول برترین‌ها بمون.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lalezar&family=Vazirmatn:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <Analytics />
      </body>
    </html>
  );
}