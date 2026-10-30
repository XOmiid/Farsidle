/* eslint-disable @next/next/no-page-custom-font -- This font is shared by the App Router root layout. */
import './globals.css';
import { ArcadeProvider } from '@/components/arcade/Provider';
export const metadata = {
  metadataBase: new URL('https://farsidle.com'),
  title: { default: 'فارسیدل — خانه بازی های کلمه ای فارسی', template: '%s | فارسیدل' },
  description:
    'خانهٔ بازی‌های روزانهٔ فارسی. فارسیدل کلاسیک: وردل، فکتل، رنگدل، کوردل، مموریدل، تیمدل و مینی‌جدول.',
  openGraph: { siteName: 'فارسیدل', locale: 'fa_IR', type: 'website' },
  robots: { index: true, follow: true },
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#182129' };
export default function Layout({ children }) {
  return (
    <html lang="fa" dir="rtl" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ArcadeProvider>{children}</ArcadeProvider>
      </body>
    </html>
  );
}
