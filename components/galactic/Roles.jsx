'use client';
import { useState } from 'react';
export default function Roles({ players, value = {}, busy, onSave, onChange }) {
  const [localRoles, setRoles] = useState(value);
  const roles = onChange ? value : localRoles;
  function change(key, id) {
    const next = { ...roles, [key]: id };
    setRoles(next);
    onChange?.(next);
  }
  if (!players.length) return null;
  return (
    <fieldset className="g-roles">
      <legend>کاپیتان و ضربات ایستگاهی</legend>
      {[
        ['captain', 'کاپیتان'],
        ['penalty', 'پنالتی‌زن'],
        ['freeKick', 'ضربهٔ آزاد'],
      ].map(([key, label]) => (
        <label key={key}>
          {label}
          <select
            aria-label={label}
            value={roles[key] || ''}
            onChange={(e) => change(key, e.target.value)}
            disabled={busy}
          >
            <option value="">انتخاب خودکار</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ))}
      {onSave && (
        <button
          className="g-text-button"
          type="button"
          disabled={busy || !players.length}
          onClick={() => onSave(roles)}
        >
          ذخیرهٔ مسئولیت‌ها
        </button>
      )}
    </fieldset>
  );
}
