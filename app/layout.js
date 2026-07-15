import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthProvider";

export const metadata = {
  title: "فارسیدل | Farsidle",
  description: "خانه‌ی بازی‌های کلمه‌ای فارسی — یک کلمه‌ی جدید هر روز.",
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
      </body>
    </html>
  );
}
