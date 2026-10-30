'use client';
import { useState, useEffect } from 'react';
import { iranTime } from '@/lib/classic/rules.mjs';
import { Icon } from './Art';
export default function IranClock() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="iran-clock" aria-label="ساعت به وقت ایران">
      <Icon name="clock" size={16} />
      <span>به وقت ایران</span>
      <time dir="ltr" dateTime={now === null ? undefined : new Date(now).toISOString()}>
        {now === null ? '—:—:—' : iranTime(now)}
      </time>
    </div>
  );
}
