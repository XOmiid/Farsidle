'use client';
import Link from 'next/link';
import Shell from './Shell';
import { Icon } from './Art';
import { useArcade, useCountdown } from './Provider';
import { fa, countdown } from '@/lib/classic/rules.mjs';
export default function Home() {
  const { player, day } = useArcade(),
    timer = useCountdown();
  const completed = new Set(
    player?.results?.filter((r) => r.date === day && r.game !== 'crossword').map((r) => r.game),
  ).size;
  return (
    <Shell>
      <section className="home-intro">
        <div className="eyebrow">فارسیدل</div>
        <h1>خانه بازی های کلمه ای فارسی</h1>
        <p>چند دقیقه بازی برای وقت‌های آزاد. هر روز با بازی‌های تازه.</p>
      </section>
      <section className="collection-card">
        <div className="collection-copy">
          <span className="pill ink-pill">مجموعهٔ اول</span>
          <h2>
            فارسیدل <span>کلاسیک</span>
          </h2>
          <p>هفت بازی روزانه؛ از کلمات و جدول تا جغرافیا، رنگ و موسیقی.</p>
          <Link className="button ink-button" href="/classic">
            انتخاب بازی
            <Icon name="arrow" size={21} />
          </Link>
          <div className="collection-detail">
            <span>۷ بازی</span>
            <span>روزانه</span>
            <span>رایگان</span>
          </div>
        </div>
        <div className="collection-illustration" aria-hidden="true">
          <div className="classic-monogram">
            <span>ف</span>
            <span>ا</span>
            <span>ر</span>
            <span>س</span>
          </div>
          <span className="collection-edition">FARSIDLE / CLASSIC</span>
        </div>
      </section>
      <section className="home-bottom">
        <div className="daily-note">
          <Icon name="collection" size={24} />
          <div>
            <h3>بازی‌های تازه، هر شب ساعت ۹</h3>
            <p>
              چالش بعدی تا <b dir="ltr">{timer === null ? '—' : countdown(timer)}</b>
            </p>
          </div>
        </div>
        <Link href="/classic" className="today-progress">
          <div>
            <span>بازی‌های امروز</span>
            <strong>
              {fa(completed)}
              <small> / ۶</small>
            </strong>
          </div>
          <div className="progress-dots">
            {Array.from({ length: 6 }, (_, i) => (
              <i key={i} className={i < completed ? 'filled' : ''} />
            ))}
          </div>
        </Link>
      </section>
      <Link href="/galactic" className="g-home-card">
        <div>
          <span className="g-kicker">فوتبال چندنفره · تازه</span>
          <h2>کهکشانی</h2>
          <p>تیمت را بساز. با دوستانت برای جام رقابت کن.</p>
          <span className="g-home-cta">ورود به کهکشانی ←</span>
        </div>
        <div className="g-home-emblem" aria-hidden="true">
          ۱۱<small>۲ تا ۸ نفر</small>
        </div>
      </Link>
    </Shell>
  );
}
