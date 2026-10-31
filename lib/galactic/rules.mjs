export function positionFit(positions, role, adjacency) {
  if (positions.includes(role)) return 1;
  if (role === 'GK') return 0.15;
  if (positions.includes('GK')) return 0.2;
  return Math.max(0.55, ...positions.map((p) => adjacency[p]?.[role] || 0));
}
export function snakeTurn(order, pick) {
  if (!order.length || !Number.isInteger(pick) || pick < 0) throw new Error('Invalid draft turn');
  const round = Math.floor(pick / order.length),
    index = pick % order.length;
  return order[round % 2 === 0 ? index : order.length - 1 - index];
}
export function effectiveRating(player, role, adjacency) {
  return Math.round(player.overall * positionFit(player.positions, role, adjacency));
}
export function matchClock(playback, now) {
  if (!playback) return 0;
  if (playback.pausedUntil && now < playback.pausedUntil) return playback.minute;
  const progress = Math.max(0, now - playback.anchorAt) / playback.minuteMs;
  return Math.min(playback.nextMinute, playback.minute + progress);
}
export function minuteLabel(minute) {
  const n = Math.max(0, minute || 0),
    m = Math.floor(n),
    s = Math.min(59, Math.floor((n - m) * 60));
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
export function bracketOrder(size) {
  if (size < 2 || size & (size - 1)) throw new Error('Invalid bracket size');
  let order = [0, 1];
  for (let n = 4; n <= size; n *= 2) order = order.flatMap((seed) => [seed, n - 1 - seed]);
  return order;
}
export function playerChemistry(player, teammates, config) {
  let score = 70;
  const links = [];
  const rules = config.chemistry || {};
  for (const other of teammates) {
    if (other.id === player.id) continue;
    const nearby = (other.x - player.x) ** 2 + (other.y - player.y) ** 2 <= 1225;
    let delta = 0,
      kind = '',
      label = '';
    if (player.club === other.club) {
      delta = rules.sameClub || 0;
      kind = 'club';
      label = 'هم‌باشگاهی';
    } else if (
      (rules.rivals || []).some((pair) => pair.includes(player.club) && pair.includes(other.club))
    ) {
      delta = rules.rivalClub || 0;
      kind = 'rival';
      label = 'رقابت باشگاهی؛ قاعدهٔ بازی';
    }
    if (!nearby) delta *= 0.2;
    for (const pair of rules.specialPairs || [])
      if (pair.players.includes(player.id) && pair.players.includes(other.id)) {
        delta = -pair.penalty;
        kind = 'special';
        label = pair.label;
      }
    score += delta;
    if (delta) links.push({ player: other.id, name: other.name, kind, label });
  }
  score = Math.max(20, Math.min(100, score));
  return {
    level: score >= 82 ? 'green' : score >= 65 ? 'blue' : score >= 45 ? 'yellow' : 'red',
    score,
    factor: Math.min(1.06, Math.max(0.88, 1 + (score - 70) / 250)),
    links,
  };
}
