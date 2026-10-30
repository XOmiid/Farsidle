'use client';
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as gateway from '@/lib/classic/gateway';
import { dateKey, rolloverAt } from '@/lib/classic/rules.mjs';
const Context = createContext(null);
export function ArcadeProvider({ children }) {
  const [player, setPlayer] = useState(null),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [day, setDay] = useState(null);
  const lastDay = useRef(null);
  const reload = useCallback(async () => {
    try {
      const profile = await gateway.profile();
      setPlayer(profile);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (alive) reload();
    };
    Promise.resolve().then(() => {
      if (alive) {
        lastDay.current = dateKey();
        setDay(lastDay.current);
      }
      refresh();
    });
    window.addEventListener('farsidle:change', refresh);
    window.addEventListener('storage', refresh);
    let subscription;
    if (!gateway.isLocal)
      gateway
        .getSupabase()
        .then((client) => {
          if (!alive) return;
          subscription = client.auth.onAuthStateChange(() => {
            setTimeout(refresh, 0);
          }).data.subscription;
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    const timer = setInterval(() => {
      const current = dateKey();
      if (current !== lastDay.current) {
        lastDay.current = current;
        setDay(current);
        refresh();
      }
    }, 1000);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('farsidle:change', refresh);
      window.removeEventListener('storage', refresh);
      subscription?.unsubscribe();
    };
  }, [reload]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <Context.Provider value={{ player, day, reload, notify: setToast }}>
      <div className="site-root">
        {error && (
          <div className="global-error" role="alert">
            {error}
            <button onClick={reload}>تلاش دوباره</button>
          </div>
        )}
        {children}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>
    </Context.Provider>
  );
}
export const useArcade = () => useContext(Context);
export function useCountdown() {
  const [value, setValue] = useState(null);
  useEffect(() => {
    let target = rolloverAt();
    const tick = () => {
      if (Date.now() >= target) target = rolloverAt();
      setValue(target - Date.now());
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);
  return value;
}
