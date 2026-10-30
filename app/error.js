'use client';
export default function ErrorPage({ reset }) {
  return (
    <main className="error-page">
      <h1>یه لحظه مکث!</h1>
      <p>صفحه درست بارگذاری نشد. پیشرفت ذخیره‌شده‌ات سر جایش است.</p>
      <button className="button" onClick={reset}>
        تلاش دوباره
      </button>
    </main>
  );
}
