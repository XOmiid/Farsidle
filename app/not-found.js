import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="error-page">
      <h1>صفحه پیدا نشد</h1>
      <p>از خانهٔ فارسیدل، بازی بعدی‌ات را پیدا کن.</p>
      <Link className="button" href="/">
        برگشت به خانه
      </Link>
    </main>
  );
}
