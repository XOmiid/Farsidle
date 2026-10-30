'use client';
import Link from 'next/link';
import { useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from './Art';
import IranClock from './IranClock';
import { useArcade } from './Provider';
import { fa } from '@/lib/classic/rules.mjs';
const NAV = [
  { href: '/', name: 'خانه', icon: 'home' },
  { href: '/classic', name: 'کلاسیک', icon: 'collection' },
  { href: '/leaderboard', name: 'برترین‌ها', icon: 'trophy' },
  { href: '/profile', name: 'پروفایل', icon: 'user' },
];
export default function Shell({ children, back, title, help }) {
  const path = usePathname(),
    { player } = useArcade();
  return (
    <>
      <a className="skip-link" href="#main">
        رفتن به محتوا
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand" aria-label="فارسیدل، خانه">
            <span className="brand-mark">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>
              فارسیدل<span className="brand-caption">بازی‌های روزانهٔ فارسی</span>
            </span>
          </Link>
          <nav className="desktop-nav" aria-label="منوی اصلی">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className={path === item.href ? 'active' : ''}>
                {item.name}
              </Link>
            ))}
          </nav>
          <Link className="wallet" href="/profile" aria-label="سکه‌ها و پروفایل">
            <span className="coin">✦</span>
            <span>{fa(player?.balance ?? 0)}</span>
          </Link>
        </div>
        <IranClock />
      </header>
      <main id="main" className="main-content">
        {back && (
          <div className="game-toolbar">
            <Link href={back} className="back-link">
              <Icon name="chevron" size={18} />
              {title || 'فارسیدل کلاسیک'}
            </Link>
            {help && (
              <button className="icon-button" aria-label="راهنمای بازی" onClick={help}>
                <Icon name="help" />
              </button>
            )}
          </div>
        )}
        {children}
      </main>
      <footer className="footer">
        <Link href="/" className="footer-brand">
          فارسیدل<span>چند دقیقه بازی، هر روز</span>
        </Link>
        <span>خانه بازی های کلمه ای فارسی</span>
      </footer>
      <nav className="bottom-nav" aria-label="ناوبری موبایل">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              path === item.href || (item.href === '/classic' && path.startsWith('/classic/'))
                ? 'active'
                : ''
            }
          >
            <Icon name={item.icon} size={21} />
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
export function Dialog({ title, onClose, children }) {
  const panel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="dialog"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          if (e.key === 'Tab') {
            const nodes = Array.from(
              panel.current.querySelectorAll('button,a[href],input,select,[tabindex="0"]'),
            ).filter((node) => !node.disabled);
            const first = nodes[0],
              last = nodes.at(-1);
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="بستن" autoFocus>
            <Icon name="close" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
