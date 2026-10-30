import countries from '@/data/residence-countries.json';
export default function OptionalDetails({ prefix, birthDate, country, onBirthDate, onCountry }) {
  return (
    <fieldset className="optional-details">
      <legend>اطلاعات اختیاری</legend>
      <label className="field-label" htmlFor={prefix + '-birth'}>
        تاریخ تولد <small>اختیاری · میلادی</small>
      </label>
      <input
        className="input"
        id={prefix + '-birth'}
        type="date"
        dir="ltr"
        autoComplete="bday"
        min="1900-01-01"
        max={new Date().toISOString().slice(0, 10)}
        value={birthDate}
        onChange={(e) => onBirthDate(e.target.value)}
      />
      <label className="field-label" htmlFor={prefix + '-country'}>
        کشور محل زندگی <small>اختیاری</small>
      </label>
      <input
        className="input"
        id={prefix + '-country'}
        list={prefix + '-countries'}
        autoComplete="country-name"
        maxLength={80}
        placeholder="انتخاب یا وارد کردن کشور"
        value={country}
        onChange={(e) => onCountry(e.target.value)}
      />
      <datalist id={prefix + '-countries'}>
        {countries.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <p className="field-hint">این اطلاعات در جدول امتیازها نمایش داده نمی‌شوند.</p>
    </fieldset>
  );
}
