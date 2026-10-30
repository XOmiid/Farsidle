export const VERSION = 'classic-2026-10';
export const GAME_IDS = [
  'wordle',
  'factle',
  'colordle',
  'chordle',
  'memorydle',
  'teamdle',
  'crossword',
];
export const fa = (value) => String(value).replace(/\d/g, (n) => '۰۱۲۳۴۵۶۷۸۹'[n]);
export const normalize = (value) =>
  String(value || '')
    .trim()
    .replace(/آ/g, 'ا')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\s\u200c]/g, '');
// Tehran is UTC+03:30; shifting another three hours makes 21:00 the game-day boundary.
export function dateKey(now = Date.now()) {
  return new Date(Number(now) + 6.5 * 3600000).toISOString().slice(0, 10);
}
export function rolloverAt(now = Date.now()) {
  return Date.parse(dateKey(now) + 'T17:30:00Z');
}
export function remaining(start, duration, now) {
  return Math.max(0, duration - Math.max(0, now - start));
}
export function countdown(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return fa(
    [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map((n) => String(n).padStart(2, '0'))
      .join(':'),
  );
}
export function rng(seed) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function feedback(guess, answer) {
  const g = [...normalize(guess)],
    a = [...normalize(answer)],
    result = g.map(() => 'absent'),
    left = {};
  a.forEach((c, i) => {
    if (c === g[i]) result[i] = 'correct';
    else left[c] = (left[c] || 0) + 1;
  });
  g.forEach((c, i) => {
    if (result[i] !== 'correct' && left[c] > 0) {
      result[i] = 'present';
      left[c]--;
    }
  });
  return result;
}
export function rgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}
export function hex(channels) {
  return (
    '#' +
    channels
      .map((n) =>
        Math.max(0, Math.min(255, Math.round(n)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export function distinctPicks(picks, grid, count = 5) {
  return (
    Array.isArray(picks) &&
    picks.length === count &&
    new Set(picks).size === count &&
    picks.every((n) => Number.isInteger(n) && grid.includes(n))
  );
}
export function createGame(game, day, catalog, now = Date.now(), crosswordId = null) {
  if (!GAME_IDS.includes(game)) throw new Error('بازی پیدا نشد.');
  const random = rng(VERSION + ':' + day + ':' + game);
  const state = {
    game,
    date: day,
    finished: false,
    won: false,
    score: 0,
    max: 0,
    history: [],
    secret: {},
    puzzle: {},
    createdAt: now,
    reward: 0,
  };
  if (game === 'wordle') {
    const word = catalog.words[Math.floor(random() * catalog.words.length)];
    state.secret.word = normalize(word);
    state.puzzle.length = normalize(word).length;
    state.max = 6;
  }
  if (game === 'factle') {
    const countries = shuffle(catalog.countries, random).slice(0, 5);
    state.secret.countries = countries;
    state.puzzle.rounds = countries.map((c) => ({
      fact: c.facts[Math.floor(random() * c.facts.length)],
      source: c.source,
    }));
    state.max = 5;
  }
  if (game === 'colordle') {
    state.secret.color = catalog.colors[Math.floor(random() * catalog.colors.length)];
    state.puzzle.revealedAt = null;
    state.max = 10;
  }
  if (game === 'memorydle') {
    state.secret.levels = [
      [0, 100],
      [100, 900],
    ].map(([start, count]) => {
      const values = shuffle(
        Array.from({ length: count }, (_, i) => start + i),
        random,
      ).slice(0, 15);
      return { targets: values.slice(0, 5), grid: shuffle(values, random) };
    });
    state.puzzle.grids = state.secret.levels.map((l) => l.grid);
    state.puzzle.startedAt = {};
    state.max = 10;
  }
  if (game === 'chordle') {
    state.puzzle.chords = shuffle(catalog.chords, random).slice(0, 9);
    state.secret.sequences = [0, 1, 2].map(() => {
      const seq = [];
      for (let i = 0; i < 5; i++) {
        const options = Array.from({ length: 9 }, (_, n) => n).filter((n) => n !== seq[i - 1]);
        seq.push(options[Math.floor(random() * options.length)]);
      }
      return seq;
    });
    state.max = 15;
  }
  if (game === 'teamdle') {
    state.secret.countries = shuffle(catalog.countries, random).slice(0, 4);
    state.puzzle.team = Math.floor(random() * 2) ? 'coral' : 'blue';
    state.puzzle.rounds = state.secret.countries.map((c) => ({
      id: c.id,
      name: c.name,
      choices: shuffle([c.capital, c.otherCity], random),
    }));
    state.puzzle.startedAt = {};
    state.max = 4;
  }
  if (game === 'crossword') {
    const puzzle =
      catalog.crosswords.find((c) => String(c.id) === String(crosswordId)) || catalog.crosswords[0];
    state.secret.crossword = puzzle;
    state.puzzle = {
      ...puzzle,
      slots: puzzle.slots.map(({ word, ...slot }) => ({ ...slot, length: normalize(word).length })),
      letters: {},
      unlocked: false,
      correct: {},
    };
    state.max = puzzle.slots.reduce((s, w) => s + normalize(w.word).length, 0);
  }
  return state;
}
export function crosswordSolution(puzzle) {
  const cells = {};
  for (const slot of puzzle.slots)
    [...normalize(slot.word)].forEach((letter, i) => {
      const key =
        slot.row +
        (slot.direction === 'down' ? i : 0) +
        '_' +
        (slot.col + (slot.direction === 'across' ? i : 0));
      if (cells[key] && cells[key] !== letter) throw new Error('Crossword conflict: ' + key);
      cells[key] = letter;
    });
  return cells;
}
function finish(s, won, reward) {
  s.finished = true;
  s.won = won;
  s.reward = reward;
}
export function applyAction(original, action, catalog, now = Date.now()) {
  const s = structuredClone(original);
  if (s.finished) return s;
  if (
    (action.day !== undefined && s.game !== 'crossword' && action.day !== s.date) ||
    s.date !== dateKey(now)
  )
    throw new Error('بازی تازه‌ای شروع شده. صفحه را دوباره باز کن.');
  if (action.round !== undefined && action.round !== s.history.length)
    throw new Error('این دور قبلاً ثبت شده. صفحه را تازه کن.');
  const { type } = action;
  if (s.game === 'wordle' && type === 'guess') {
    const word = normalize(action.word);
    if (word.length !== s.puzzle.length || !/^[ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی]+$/.test(word))
      throw new Error('حروف فارسی را با تعداد مشخص‌شده وارد کن.');
    if (s.history.some((h) => h.word === word)) throw new Error('این واژه را قبلاً امتحان کردی.');
    const result = feedback(word, s.secret.word);
    s.history.push({ word, result });
    if (word === s.secret.word) {
      s.score = 7 - s.history.length;
      finish(s, true, 50);
    } else if (s.history.length === 6) finish(s, false, 0);
  } else if (s.game === 'factle' && type === 'guess') {
    const index = s.history.length,
      country = s.secret.countries[index];
    if (!country) throw new Error('دور نامعتبر است.');
    const selected = catalog.countries.find((c) => c.id === action.country);
    if (!selected && !action.skip) throw new Error('یک کشور از پیشنهادها انتخاب کن.');
    const correct = selected?.id === country.id;
    s.history.push({
      correct,
      answer: country.name,
      guess: selected?.name || 'گذشتم',
      source: country.source,
    });
    s.score += correct ? 1 : 0;
    if (s.history.length === 5) finish(s, s.score >= 3, s.score * 20);
  } else if (s.game === 'colordle') {
    if (type === 'reveal') {
      s.puzzle.revealedAt ??= now;
    } else if (type === 'color') {
      if (!s.puzzle.revealedAt || now - s.puzzle.revealedAt < 10000)
        throw new Error('اول رنگ را ببین و به خاطر بسپار.');
      if (
        !Array.isArray(action.rgb) ||
        action.rgb.length !== 3 ||
        action.rgb.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
      )
        throw new Error('رنگ معتبر نیست.');
      const target = rgb(s.secret.color.hex);
      s.puzzle.guess = hex(action.rgb);
      s.score =
        Math.round(
          Math.max(
            0,
            10 *
              (1 -
                Math.hypot(...target.map((n, i) => n - action.rgb[i])) / Math.sqrt(3 * 255 ** 2)),
          ) * 100,
        ) / 100;
      finish(s, s.score >= 7, Math.round(s.score * 10));
    } else throw new Error('درخواست معتبر نیست.');
  } else if (s.game === 'memorydle') {
    const level = s.history.length;
    if (type === 'start') s.puzzle.startedAt[level] ??= now;
    else if (type === 'memory') {
      const l = s.secret.levels[level];
      if (!l || !s.puzzle.startedAt[level] || now - s.puzzle.startedAt[level] < 12000)
        throw new Error('اول نمایش اعداد را کامل ببین.');
      if (!distinctPicks(action.picks, l.grid)) throw new Error('پنج عدد متفاوت انتخاب کن.');
      const score = action.picks.filter((n) => l.targets.includes(n)).length;
      s.history.push({ score, targets: l.targets, picks: action.picks });
      s.score += score;
      if (s.history.length === 2) finish(s, s.score >= 8, s.score * 10);
    } else throw new Error('درخواست معتبر نیست.');
  } else if (s.game === 'chordle' && type === 'chords') {
    const seq = s.secret.sequences[s.history.length];
    if (
      !seq ||
      !Array.isArray(action.slots) ||
      action.slots.length !== 5 ||
      action.slots.some((n) => !Number.isInteger(n) || n < 0 || n > 8)
    )
      throw new Error('هر پنج خانه را با صداها پر کن.');
    const correct = seq.map((n, i) => n === action.slots[i]);
    const score = correct.filter(Boolean).length;
    s.history.push({ score, correct, sequence: seq });
    s.score += score;
    if (s.history.length === 3) finish(s, s.score >= 12, s.score * 10);
  } else if (s.game === 'teamdle') {
    const index = s.history.length;
    if (type === 'start') s.puzzle.startedAt[index] ??= now;
    else if (type === 'capital') {
      const country = s.secret.countries[index];
      const started = s.puzzle.startedAt[index];
      if (!country || !started) throw new Error('اول دور را شروع کن.');
      if (action.answer !== null && !s.puzzle.rounds[index].choices.includes(action.answer))
        throw new Error('یکی از دو گزینه را انتخاب کن.');
      const correct = now - started <= 6000 && action.answer === country.capital;
      s.history.push({ correct, answer: country.capital, name: country.name });
      s.score += correct ? 1 : 0;
      if (s.history.length === 4) finish(s, s.score >= 3, 0);
    } else throw new Error('درخواست معتبر نیست.');
  } else if (s.game === 'crossword') {
    if (!s.puzzle.unlocked) throw new Error('اول جدول را باز کن.');
    const cells = crosswordSolution(s.secret.crossword);
    if (type === 'letter') {
      if (
        !(action.cell in cells) ||
        (action.letter !== '' &&
          !/^[ابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی]$/.test(normalize(action.letter)))
      )
        throw new Error('حرف یا خانه معتبر نیست.');
      s.puzzle.letters[action.cell] = normalize(action.letter);
      s.puzzle.correct = {};
    } else if (type === 'check') {
      s.puzzle.correct = Object.fromEntries(
        Object.entries(cells).map(([key, letter]) => [key, letter === s.puzzle.letters[key]]),
      );
      if (Object.values(s.puzzle.correct).every(Boolean)) {
        s.score = s.max;
        finish(s, true, 0);
      }
    } else throw new Error('درخواست معتبر نیست.');
  } else throw new Error('درخواست معتبر نیست.');
  return s;
}
export function gameView(state) {
  const s = structuredClone(state);
  delete s.secret;
  if (s.game === 'wordle' && s.finished) s.answer = state.secret.word;
  if (s.game === 'colordle' && (s.finished || s.puzzle.revealedAt))
    s.puzzle.target = state.secret.color;
  if (s.game === 'memorydle')
    s.puzzle.targets = state.secret.levels.map((l, i) =>
      s.puzzle.startedAt[i] ? l.targets : null,
    );
  if (s.game === 'chordle') s.puzzle.sequences = state.secret.sequences;
  return s;
}
