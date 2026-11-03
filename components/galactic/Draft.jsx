'use client';
import { useState } from 'react';
import { Dialog } from '@/components/arcade/Shell';
import { fa } from '@/lib/classic/rules.mjs';
import {
  positionFit,
  snakeTurn,
  playerChemistry,
  draftSuggestions,
} from '@/lib/galactic/rules.mjs';
import { Pitch, ChemistryLegend, chemistryLabels } from './Common';
import Manual from './Manual';
import Roles from './Roles';
const leagues = {
  'premier-league': 'انگلستان',
  laliga: 'اسپانیا',
  'ligue-1': 'فرانسه',
  'serie-a': 'ایتالیا',
  bundesliga: 'آلمان',
};
export default function Draft({ room, catalog, self, now, busy, action }) {
  const [slotId, setSlot] = useState(null),
    [query, setQuery] = useState(''),
    [league, setLeague] = useState(''),
    [club, setClub] = useState(''),
    [specialist, setSpecialist] = useState(true),
    [suggestions, setSuggestions] = useState([]),
    [view, setView] = useState(self.id),
    [help, setHelp] = useState(false);
  const config = catalog.config,
    slots = config.formations[self.formation].slots,
    slot = slots.find((s) => s.id === slotId),
    mine = room.turn === self.id,
    turn = room.members.find((m) => m.id === room.turn),
    viewTeam = room.members.find((m) => m.id === view) || self;
  const seconds = Math.min(
      60,
      Math.max(0, Math.ceil((new Date(room.pickDeadline).getTime() - now) / 1000)),
    ),
    needle = query.trim().toLowerCase();
  const clubs = [
    ...new Set(catalog.players.filter((p) => !league || p.league === league).map((p) => p.club)),
  ].sort();
  const available = catalog.players.filter((p) => !room.picks.some((pick) => pick.player === p.id));
  const limited = room.selection === 'draft';
  const offer = room.offers?.find((o) => o.context === 'draft' && o.slot === slotId);
  const usedReroll =
    room.rerolls?.draft || room.offers?.some((o) => o.context === 'draft' && o.rerolled);
  const browsing = !!(needle || club || league || !specialist);
  const results = (
    limited
      ? (offer?.players || []).map((id) => available.find((p) => p.id === id)).filter(Boolean)
      : browsing
        ? available
        : suggestions.map((id) => available.find((p) => p.id === id)).filter(Boolean)
  )
    .filter(
      (p) =>
        (!league || p.league === league) &&
        (!club || p.club === club) &&
        (!specialist || !slot || p.positions.includes(slot.role)) &&
        (!needle ||
          (p.name + ' ' + p.club + ' ' + (p.aliases || []).join(' '))
            .toLowerCase()
            .includes(needle)),
    )
    .sort((a, b) => (browsing ? a.name.localeCompare(b.name) : 0));
  function randomSuggestions(role) {
    setSuggestions(draftSuggestions(catalog.players, room.picks, role));
  }
  const occupied = slot && self.players.some((p) => p.slot === slot.id);
  async function open(id) {
    if (self.players.some((p) => p.slot === id)) return;
    setSlot(id);
    setQuery('');
    setLeague('');
    setClub('');
    setSpecialist(true);
    if (limited) await action({ type: 'offers', slot: id });
    else randomSuggestions(slots.find((s) => s.id === id).role);
  }
  return (
    <>
      <section className={'g-turn' + (mine ? ' my-turn' : '')} aria-live="polite">
        <div>
          <span className="g-kicker">
            انتخاب {fa(room.pickNumber + 1)} از {fa(room.members.length * 11)}
          </span>
          <h2>{mine ? 'نوبت انتخاب توست' : 'نوبت ' + turn?.name}</h2>
          <p>روی جایگاه خالی در ترکیب خودت بزن و بازیکن انتخاب کن.</p>
        </div>
        <div className="g-pick-clock" aria-label={'زمان باقی‌مانده ' + fa(seconds) + ' ثانیه'}>
          <b>{fa(seconds)}</b>
          <small>ثانیه</small>
        </div>
      </section>
      <div className="g-draft-order" aria-label="ترتیب انتخاب‌های بعدی">
        {Array.from(
          { length: Math.min(room.members.length + 2, room.members.length * 11 - room.pickNumber) },
          (_, i) => {
            const id = snakeTurn(room.draftOrder, room.pickNumber + i),
              m = room.members.find((m) => m.id === id);
            return (
              <span key={i} className={i === 0 ? 'current' : ''}>
                {fa(room.pickNumber + i + 1)}. {m.name}
              </span>
            );
          },
        )}
      </div>
      <div className="g-draft-grid g-formation-draft">
        <section className="g-panel">
          <div className="g-section-title">
            <h2>ترکیب تو</h2>
            <button className="g-text-button" onClick={() => setHelp(true)}>
              راهنمای بازی
            </button>
          </div>
          <div className="g-lineup-caption">
            <b>{self.teamName}</b>
            <span dir="ltr">{config.formations[self.formation].name}</span>
            <small>{fa(self.players.length)} / ۱۱</small>
          </div>
          <Pitch
            formation={self.formation}
            players={self.players}
            config={config}
            selected={slotId}
            onSelect={open}
          />
          <ChemistryLegend />
          <Roles
            key={JSON.stringify(self.roles)}
            players={self.players}
            value={self.roles}
            busy={busy}
            onSave={(roles) => action({ type: 'roles', roles })}
          />
          <p className="g-muted">
            {config.tactics[self.tactic].name} · {config.tactics[self.tactic].description}
          </p>
          <p className="g-muted">
            پست تخصصی، سبک بازی و هماهنگی بازیکنان را در نظر بگیر. امتیاز عددی نمایش داده نمی‌شود.
          </p>
        </section>
        <aside>
          <section className="g-panel">
            <h2>تیم‌های اتاق</h2>
            <label>
              نمایش تیم
              <select value={viewTeam.id} onChange={(e) => setView(e.target.value)}>
                {room.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.teamName} · {fa(m.players.length)} / ۱۱
                  </option>
                ))}
              </select>
            </label>
            <Pitch
              compact
              formation={viewTeam.formation}
              players={viewTeam.players}
              config={config}
            />
            <div className="g-lineup-caption">
              <span dir="ltr">{config.formations[viewTeam.formation].name}</span>
              <span>{config.tactics[viewTeam.tactic].name}</span>
            </div>
          </section>
          <details className="g-panel">
            <summary>انتخاب‌های اخیر</summary>
            <ol className="g-history">
              {room.picks
                .slice(-12)
                .reverse()
                .map((p) => {
                  const footballer = catalog.players.find((x) => x.id === p.player),
                    m = room.members.find((x) => x.id === p.member);
                  return (
                    <li key={p.number}>
                      <b dir="ltr">{footballer.name}</b>
                      <small>
                        {m.teamName}
                        {p.automatic ? ' · خودکار' : ''}
                      </small>
                    </li>
                  );
                })}
            </ol>
          </details>
          <p className="g-muted">
            زمان هر انتخاب ۶۰ ثانیه است؛ پس از آن سیستم یک جایگاه خالی را پر می‌کند. انتخاب‌ها در
            این اتاق مشترک‌اند و هر بازیکن فقط در یک تیم قرار می‌گیرد.
          </p>
        </aside>
      </div>
      {slot && (
        <Dialog title={'انتخاب ' + config.roles[slot.role]} onClose={() => setSlot(null)}>
          <div className="galactic g-search-dialog">
            {!limited && (
              <>
                <label>
                  نام بازیکن
                  <input
                    autoComplete="off"
                    aria-label="نام بازیکن"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search player name…"
                    dir="ltr"
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
                    {Object.entries(config.leagues || leagues).map(([id, name]) => (
                      <option key={id} value={id}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  باشگاه
                  <select
                    aria-label="باشگاه"
                    value={club}
                    onChange={(e) => setClub(e.target.value)}
                  >
                    <option value="">همهٔ باشگاه‌ها</option>
                    {clubs.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={specialist}
                    onChange={(e) => setSpecialist(e.target.checked)}
                  />
                  فقط بازیکنان همین پست
                </label>
              </>
            )}
            {limited && (
              <div>
                <p className="g-muted">
                  فقط از پیشنهادهای ذخیره‌شدهٔ این جایگاه انتخاب کن. کیفیت جایگاه‌ها ترکیبی از
                  بازیکنان خوب و متوسط است.
                </p>
                <button
                  className="button secondary-button"
                  disabled={busy || usedReroll || !offer}
                  onClick={() => action({ type: 'reroll', slot: slot.id })}
                >
                  {usedReroll ? 'ری‌رول استفاده شد' : 'ری‌رول؛ پیشنهادهای قوی‌تر (یک بار)'}
                </button>
              </div>
            )}
            {!limited && !browsing && (
              <div className="g-section-title">
                <p className="g-muted">پنج پیشنهاد تصادفی از بازیکنان آزاد این پست</p>
                <button className="g-text-button" onClick={() => randomSuggestions(slot.role)}>
                  پیشنهادهای تازه
                </button>
              </div>
            )}
            {!results.length ? (
              <p className="g-muted">
                بازیکن آزادی با این فیلترها پیدا نشد؛ باشگاه یا پست را تغییر بده.
              </p>
            ) : (
              <div className="g-player-list">
                {results.slice(0, 40).map((p) => {
                  const fit = positionFit(p.positions, slot.role, config.adjacency),
                    chemistry = playerChemistry({ ...p, ...slot, id: p.id }, self.players, config),
                    already = room.picks.find((pick) => pick.player === p.id);
                  return (
                    <div className="g-player-row" key={p.id}>
                      <div className="g-player-copy">
                        <b dir="ltr">{p.name}</b>
                        <small dir="ltr">{p.club}</small>
                        <span>{p.positions.map((pos) => config.roles[pos]).join(' / ')}</span>
                        {p.heightCm && <small>قد: {fa(p.heightCm)} سانتی‌متر</small>}
                        {fit < 1 && <small className="g-fit">پست غیرتخصصی؛ افت عملکرد</small>}
                        <span className={'g-chemistry-preview chemistry-text-' + chemistry.level}>
                          <i className={'g-chemistry-dot chemistry-' + chemistry.level} />
                          هماهنگی پیشنهادی: {chemistryLabels[chemistry.level]}
                        </span>
                        {chemistry.links.map((link) => (
                          <small key={link.player}>
                            {link.name} · {link.label}
                          </small>
                        ))}
                        <span className="g-player-traits">{p.tags?.join(' · ')}</span>
                        {already && (
                          <small className="g-fit">
                            انتخاب شده توسط{' '}
                            {room.members.find((m) => m.id === already.member)?.teamName}
                          </small>
                        )}
                      </div>
                      <button
                        className="g-pick-button"
                        disabled={!mine || busy || occupied || !!already}
                        onClick={async () => {
                          await action({
                            type: 'pick',
                            pickNumber: room.pickNumber,
                            player: p.id,
                            slot: slot.id,
                          });
                          setSlot(null);
                        }}
                        aria-label={'انتخاب ' + p.name}
                      >
                        انتخاب
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {results.length > 40 && (
              <p className="g-muted">نام دقیق‌تری بنویس تا نتیجه‌ها محدود شوند.</p>
            )}
            {!mine && (
              <p className="g-muted">
                تا رسیدن نوبتت می‌توانی جست‌وجو کنی؛ ثبت انتخاب فقط در نوبت خودت ممکن است.
              </p>
            )}
            {occupied && <p className="g-muted">این جایگاه اکنون پر شده است.</p>}
          </div>
        </Dialog>
      )}
      {help && (
        <Dialog title="راهنمای کهکشانی" onClose={() => setHelp(false)}>
          <Manual embedded />
        </Dialog>
      )}
    </>
  );
}
