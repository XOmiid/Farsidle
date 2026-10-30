import catalog from '@/data/catalog.json';
import { profileDetails } from './account.mjs';
import { VERSION, createGame, applyAction, gameView, dateKey } from './rules.mjs';
const hasConnection = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
export const isLocal =
  process.env.NEXT_PUBLIC_DATA_MODE === 'local' ||
  (!process.env.NEXT_PUBLIC_DATA_MODE && !hasConnection);
const KEY = 'farsidle:' + VERSION + (isLocal ? ':preview' : ':guest');
let client;
export async function getSupabase() {
  if (isLocal) return null;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    throw new Error('اتصال حساب هنوز تنظیم نشده است.');
  if (!client) {
    // Cache the import promise immediately so simultaneous startup requests share
    // one Auth client and its session subscription.
    client = import('@supabase/supabase-js')
      .then(({ createClient }) =>
        createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          {
            auth: {
              flowType: 'pkce',
              persistSession: true,
              autoRefreshToken: true,
              detectSessionInUrl: true,
            },
          },
        ),
      )
      .catch((error) => {
        client = undefined;
        throw error;
      });
  }
  return client;
}
function read() {
  const raw = localStorage.getItem(KEY);
  if (!raw)
    return {
      profile: { name: 'بازیکن', avatar: '◉' },
      games: {},
      ledger: isLocal ? { 'preview-starter': 5000 } : {},
      streaks: {},
      purchases: [],
      claim: null,
    };
  try {
    const data = JSON.parse(raw);
    if (
      !data.profile ||
      !data.games ||
      !data.ledger ||
      !data.streaks ||
      !Array.isArray(data.purchases)
    )
      throw new Error();
    // Update built-in defaults and older Teamdle options without discarding saved progress.
    if (data.profile.name === 'بازیکن کنجکاو') data.profile.name = 'بازیکن';
    if (data.profile.avatar === '🙂') data.profile.avatar = '◉';
    for (const state of Object.values(data.games)) {
      if (state.game !== 'teamdle') continue;
      state.puzzle.rounds.forEach((round) => {
        const country = catalog.countries.find((c) => c.id === round.id);
        if (country)
          round.choices = round.choices.map((city) =>
            city === country.capital ? city : country.otherCity,
          );
      });
    }
    return data;
  } catch {
    throw new Error('اطلاعات ذخیره‌شده قابل خواندن نیست. از تنظیمات، پیشرفت محلی را بازنشانی کن.');
  }
}
function write(db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    throw new Error('ذخیره نشد. فضای ذخیره‌سازی مرورگر را بررسی کن.');
  }
  window.dispatchEvent(new Event('farsidle:change'));
}
async function locked(fn) {
  return navigator.locks ? navigator.locks.request(KEY, fn) : fn();
}
const balance = (db) => Object.values(db.ledger).reduce((sum, n) => sum + n, 0);
const keyFor = (game, id) =>
  game === 'crossword' ? 'crossword:' + (id || catalog.crosswords[0].id) : dateKey() + ':' + game;
async function rpc(name, args = {}) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc(name, args);
  if (error)
    throw new Error(
      /[\u0600-\u06ff]/.test(error.message)
        ? error.message
        : 'ارتباط برقرار نشد. دوباره امتحان کن.',
    );
  return data;
}
export async function signedIn() {
  const supabase = await getSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return !!data.session;
}
export async function profile() {
  if (!isLocal && (await signedIn())) return rpc('classic_profile');
  const db = read();
  return {
    ...db.profile,
    balance: balance(db),
    claim: db.claim,
    local: true,
    streaks: Object.fromEntries(
      Object.entries(db.streaks).map(([game, s]) => [
        game,
        { ...s, count: s.date >= dateKey(Date.now() - 86400000) ? s.count : 0 },
      ]),
    ),
    results: Object.values(db.games)
      .filter((g) => g.finished)
      .map((g) => ({ game: g.game, date: g.date, score: g.score, max: g.max, won: g.won })),
  };
}
export async function updateProfile(name, avatar, details = {}) {
  const optional = profileDetails(details);
  const clean = name.trim();
  if (clean.length < 3 || clean.length > 20 || !/^[a-zA-Z0-9_آ-ی]+$/.test(clean))
    throw new Error('نام کاربری باید ۳ تا ۲۰ حرف، عدد یا زیرخط باشد.');
  if (!isLocal && (await signedIn()))
    return rpc('classic_update_profile', { p_name: clean, p_avatar: avatar, p_details: optional });
  return locked(() => {
    const db = read();
    db.profile = { name: clean, avatar, ...optional };
    write(db);
  });
}
export async function claimDaily() {
  if (!isLocal) {
    if (!(await signedIn())) throw new Error('برای دریافت سکه وارد حساب شو.');
    return rpc('classic_claim');
  }
  return locked(() => {
    const db = read();
    const day = dateKey();
    if (db.claim !== day) {
      db.ledger[day + ':daily'] = 25;
      db.claim = day;
      write(db);
    }
    return 25;
  });
}
export async function getGame(game, id) {
  if (!isLocal && (await signedIn()))
    return rpc('classic_get', { p_game: game, p_id: id ? String(id) : null });
  return locked(() => {
    const db = read(),
      key = keyFor(game, id);
    if (!db.games[key]) {
      db.games[key] = createGame(game, dateKey(), catalog, Date.now(), id);
      if (game === 'crossword')
        db.games[key].puzzle.unlocked = db.purchases.includes(String(db.games[key].puzzle.id));
      write(db);
    }
    return gameView(db.games[key]);
  });
}
export async function act(game, action, id) {
  if (!isLocal && (await signedIn()))
    return rpc('classic_act', { p_game: game, p_action: action, p_id: id ? String(id) : null });
  return locked(() => {
    const db = read(),
      key = keyFor(game, id),
      previous = db.games[key] || createGame(game, dateKey(), catalog, Date.now(), id);
    if (game === 'crossword') previous.date = dateKey();
    let next;
    if (game === 'crossword' && action.type === 'purchase') {
      next = structuredClone(previous);
      const purchaseId = String(next.puzzle.id);
      if (!db.purchases.includes(purchaseId)) {
        if (balance(db) < next.puzzle.cost)
          throw new Error('هنوز سکهٔ کافی نداری. با بازی‌های روزانه بیشتر جمع کن.');
        db.ledger['crossword:' + purchaseId] = -next.puzzle.cost;
        db.purchases.push(purchaseId);
      }
      next.puzzle.unlocked = true;
    } else next = applyAction(previous, action, catalog);
    if (next.finished && !previous.finished) {
      db.ledger[key] ??= next.reward;
      const old = db.streaks[game];
      if (next.won) {
        const yesterday = new Date(Date.parse(next.date + 'T00:00:00Z') - 86400000)
          .toISOString()
          .slice(0, 10);
        db.streaks[game] = {
          date: next.date,
          count: old?.date === yesterday ? old.count + 1 : old?.date === next.date ? old.count : 1,
        };
      } else db.streaks[game] = { date: next.date, count: 0 };
    }
    db.games[key] = next;
    write(db);
    return gameView(next);
  });
}
export async function leaderboard(game) {
  if (!isLocal) return rpc('classic_leaderboard', { p_game: game });
  const db = read(),
    state = db.games[keyFor(game)];
  return state?.finished
    ? [
        {
          name: db.profile.name,
          avatar: db.profile.avatar,
          score: state.score,
          max: state.max,
          won: state.won,
          team: state.puzzle.team,
          self: true,
        },
      ]
    : [];
}
export function resetLocal() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event('farsidle:change'));
}
export { catalog };
