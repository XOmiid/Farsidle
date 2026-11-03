'use client';
import { useState } from 'react';
import { Dialog } from '@/components/arcade/Shell';
import { fa } from '@/lib/classic/rules.mjs';
import { positionFit, playerChemistry } from '@/lib/galactic/rules.mjs';
import { Pitch } from './Common';
import Roles from './Roles';
export default function Halftime({ room, catalog, now, busy, action }) {
  const half = room.halftime,
    cfg = catalog.config;
  const [formation, setFormation] = useState(half.setup.formation),
    [tactic, setTactic] = useState(half.setup.tactic),
    [players, setPlayers] = useState(half.setup.players),
    [roles, setRoles] = useState(half.setup.roles || {}),
    [slot, setSlot] = useState(null),
    [query, setQuery] = useState(''),
    [club, setClub] = useState(''),
    [league, setLeague] = useState(''),
    [specialist, setSpecialist] = useState(true);
  const slots = cfg.formations[formation].slots,
    target = slots.find((s) => s.id === slot),
    limited = room.selection === 'draft';
  const offer = room.offers?.find((o) => o.context === half.match && o.slot === slot),
    rerolled =
      room.rerolls?.[half.match] ||
      room.offers?.some((o) => o.context === half.match && o.rerolled);
  const initial = new Set(half.initial.players.map((p) => p.id));
  const changes = players.filter((p) => !initial.has(p.id)).length;
  const excluded = new Set([
    ...room.picks.map((p) => p.player),
    ...(room.unavailable || []),
    ...players.map((p) => p.id),
  ]);
  const available = catalog.players.filter((p) => !excluded.has(p.id));
  const candidates = (
    limited
      ? (offer?.players || []).map((id) => available.find((p) => p.id === id)).filter(Boolean)
      : available
  ).filter(
    (p) =>
      limited ||
      ((!query || (p.name + ' ' + p.club).toLowerCase().includes(query.toLowerCase())) &&
        (!club || p.club === club) &&
        (!league || p.league === league) &&
        (!specialist || !target || p.positions.includes(target.role))),
  );
  function placed(list, f) {
    const placed = list.map((p) => {
      const s = cfg.formations[f].slots.find((s) => s.id === p.slot);
      return {
        ...p,
        role: s.role,
        x: s.x,
        y: s.y,
        fit: positionFit(p.positions, s.role, cfg.adjacency),
      };
    });
    return placed.map((p) => ({ ...p, chemistry: playerChemistry(p, placed, cfg) }));
  }
  function reshape(next) {
    const remaining = [...players],
      nextPlayers = [];
    // Keep dismissed players on the pitch; they remain ineligible, not replaced.
    for (const s of cfg.formations[next].slots) {
      const i = remaining.reduce(
        (best, p, index) =>
          positionFit(p.positions, s.role, cfg.adjacency) >
          positionFit(remaining[best].positions, s.role, cfg.adjacency)
            ? index
            : best,
        0,
      );
      nextPlayers.push({ ...remaining.splice(i, 1)[0], slot: s.id });
    }
    setFormation(next);
    setPlayers(placed(nextPlayers, next));
  }
  function swap(a, b) {
    if (
      half.sentOff.includes(players.find((p) => p.slot === a)?.id) ||
      half.sentOff.includes(players.find((p) => p.slot === b)?.id)
    )
      return;
    setPlayers(
      placed(
        players.map((p) => ({ ...p, slot: p.slot === a ? b : p.slot === b ? a : p.slot })),
        formation,
      ),
    );
  }
  async function open(id) {
    if (half.sentOff.includes(players.find((p) => p.slot === id)?.id)) return;
    setSlot(id);
    setQuery('');
    setClub('');
    setLeague('');
    if (limited) await action({ type: 'offers', match: half.match, slot: id, formation });
  }
  function replace(p) {
    const outgoing = players.find((x) => x.slot === slot);
    const next = players.map((x) => (x.slot === slot ? { ...p, slot } : x));
    if (next.filter((x) => !initial.has(x.id)).length > 5) return;
    setPlayers(placed(next, formation));
    setRoles((old) =>
      Object.fromEntries(Object.entries(old).map(([k, v]) => [k, v === outgoing.id ? p.id : v])),
    );
    setSlot(null);
  }
  const seconds = Math.max(0, Math.ceil((new Date(half.until) - now) / 1000));
  const countdown = fa(Math.floor(seconds / 60)) + ':' + fa(seconds % 60).padStart(2, '۰');
  if (half.saved)
    return (
      <section className="g-panel g-halftime-wait" role="status">
        <b>تغییرات ذخیره و قفل شد</b>
        <span dir="ltr" aria-label="زمان باقی‌ماندهٔ بین دو نیمه">
          {countdown}
        </span>
        <p>منتظر ذخیرهٔ تیم مقابل هستیم؛ پس از آمادگی هر دو تیم، بازی فوراً ادامه پیدا می‌کند.</p>
      </section>
    );
  return (
    <section className="g-panel g-halftime">
      <div className="g-section-title g-halftime-countdown">
        <h2>بین دو نیمه</h2>
        <b dir="ltr" aria-label="زمان باقی‌ماندهٔ بین دو نیمه">
          {countdown}
        </b>
      </div>
      <p>
        آرایش و تاکتیک را تغییر بده. برای جابه‌جایی، بازیکن را بگیر و روی جایگاه دیگر بکش؛ برای
        تعویض روی او بزن. تغییرات را پیش از پایان زمان ذخیره کن.
      </p>
      <p className="g-muted">حداکثر ۵ تعویض · انتخاب فعلی: {fa(changes)} · فقط برای همین مسابقه</p>
      <label>
        آرایش
        <select
          aria-label="آرایش"
          dir="ltr"
          value={formation}
          onChange={(e) => reshape(e.target.value)}
        >
          {Object.entries(cfg.formations).map(([id, f]) => (
            <option key={id} value={id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        تاکتیک
        <select aria-label="تاکتیک" value={tactic} onChange={(e) => setTactic(e.target.value)}>
          {Object.entries(cfg.tactics).map(([id, t]) => (
            <option key={id} value={id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <Pitch
        formation={formation}
        players={players.map((p) => ({ ...p, captain: p.id === roles.captain }))}
        config={cfg}
        onSelect={open}
        onSwap={swap}
        sentOff={half.sentOff}
      />
      <Roles
        players={players.filter((p) => !half.sentOff.includes(p.id))}
        value={roles}
        onChange={setRoles}
      />
      <button
        className="button ink-button g-full"
        disabled={busy || seconds === 0}
        onClick={() =>
          action({
            type: 'halftime',
            match: half.match,
            formation,
            tactic,
            roles,
            players: players.map((p) => ({ id: p.id, slot: p.slot })),
          })
        }
      >
        ذخیره و بازگشت به بازی
      </button>
      <p className="g-muted">
        با ذخیره، تغییرات قفل می‌شود و به بازی برمی‌گردی. اگر هر دو تیم ذخیره کنند، نیمهٔ دوم
        بلافاصله شروع می‌شود. پس از پایان دو دقیقه، ترکیب ذخیره‌نشده به حالت قبلی ادامه می‌دهد.
      </p>
      {target && (
        <Dialog title={'تعویض ' + cfg.roles[target.role]} onClose={() => setSlot(null)}>
          <div className="galactic g-search-dialog">
            {limited ? (
              <>
                <p>پنج پیشنهاد ذخیره‌شدهٔ این جایگاه</p>
                <button
                  className="button secondary-button"
                  disabled={busy || rerolled || !offer}
                  onClick={() => action({ type: 'reroll', match: half.match, slot, formation })}
                >
                  {rerolled
                    ? 'ری‌رول این مسابقه استفاده شد'
                    : 'ری‌رول برای بازیکنان بهتر؛ یک بار در این مسابقه'}
                </button>
              </>
            ) : (
              <>
                <label className="g-checkbox">
                  <input
                    type="checkbox"
                    checked={specialist}
                    onChange={(e) => setSpecialist(e.target.checked)}
                  />
                  فقط بازیکنان همین پست
                </label>
                <label>
                  نام بازیکن
                  <input
                    dir="ltr"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search player…"
                  />
                </label>
                <label>
                  لیگ
                  <select
                    value={league}
                    onChange={(e) => {
                      setLeague(e.target.value);
                      setClub('');
                    }}
                  >
                    <option value="">همهٔ لیگ‌ها</option>
                    {Object.entries(cfg.leagues || {}).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  باشگاه
                  <select value={club} onChange={(e) => setClub(e.target.value)}>
                    <option value="">همهٔ باشگاه‌ها</option>
                    {[
                      ...new Set(
                        available.filter((p) => !league || p.league === league).map((p) => p.club),
                      ),
                    ]
                      .sort()
                      .map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                  </select>
                </label>
              </>
            )}
            <div className="g-player-list">
              {candidates.slice(0, 40).map((p) => (
                <div className="g-player-row" key={p.id}>
                  <div className="g-player-copy">
                    <b dir="ltr">{p.name}</b>
                    <small dir="ltr">{p.club}</small>
                    <small>{p.positions.map((k) => cfg.roles[k]).join(' / ')}</small>
                  </div>
                  <button
                    className="g-pick-button"
                    aria-label={'انتخاب ' + p.name}
                    disabled={
                      busy ||
                      (changes >= 5 && initial.has(players.find((x) => x.slot === slot)?.id))
                    }
                    onClick={() => replace(p)}
                  >
                    انتخاب
                  </button>
                </div>
              ))}
            </div>
            {!candidates.length && <p>بازیکن آزادی برای این فیلترها پیدا نشد.</p>}
          </div>
        </Dialog>
      )}
    </section>
  );
}
