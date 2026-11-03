// Performance ratings describe revealed match actions, never underlying player ability.
export function matchRatings(players, events, side) {
  const roster = new Map(players.map((p) => [p.id, { ...p, value: 6.5, goals: 0, assists: 0 }]));
  const adjust = (actor, delta, stat) => {
    if (!actor?.id || actor.side !== side) return;
    if (!roster.has(actor.id)) roster.set(actor.id, { ...actor, value: 6.5, goals: 0, assists: 0 });
    const p = roster.get(actor.id);
    p.value += delta;
    if (stat) p[stat]++;
  };
  for (const e of events) {
    if (e.goodPass) adjust(e.actor, 0.08);
    if (e.mistake) adjust(e.actor, -0.12);
    if (e.kind === 'goal') {
      adjust(e.actor, e.actor?.role === 'ST' ? 0.85 : 1.05, 'goals');
      adjust(e.provider, 0.5, 'assists');
      adjust(e.keeper, -0.22);
    } else if (e.kind === 'save') {
      adjust(e.actor, 0.04);
      adjust(e.keeper, 0.25);
    } else if (e.kind === 'miss') adjust(e.actor, e.chanceType === 'penalty_kick' ? -0.65 : -0.15);
    else if (e.kind === 'woodwork') adjust(e.actor, -0.05);
    else if (e.kind === 'yellow_card') adjust(e.actor, -0.25);
    else if (e.kind === 'red_card') adjust(e.actor, -1.2);
    else if (e.kind === 'corner_won') adjust(e.actor, 0.08);
    else if (e.kind === 'foul') adjust(e.actor, -0.05);
  }
  return [...roster.values()].map((p) => ({
    ...p,
    rating: (Math.round(Math.min(10, Math.max(1, p.value)) * 10 + 1e-8) / 10).toFixed(1),
  }));
}
export function teamIncidents(events, side) {
  return events.filter(
    (e) => ['goal', 'yellow_card', 'red_card'].includes(e.kind) && e.actor?.side === side,
  );
}
