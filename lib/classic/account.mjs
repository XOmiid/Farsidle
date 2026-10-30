export function profileDetails(
  { birthDate = '', country = '' } = {},
  today = new Date().toISOString().slice(0, 10),
) {
  const birth = String(birthDate || '').trim();
  const residence = String(country || '').trim();
  if (
    birth &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(birth) ||
      Number.isNaN(Date.parse(birth + 'T00:00:00Z')) ||
      new Date(birth + 'T00:00:00Z').toISOString().slice(0, 10) !== birth ||
      birth < '1900-01-01' ||
      birth > today)
  )
    throw new Error('تاریخ تولد معتبر وارد کن؛ این فیلد اختیاری است.');
  if (residence.length > 80 || /[<>\u0000-\u001f]/.test(residence))
    throw new Error('نام کشور معتبر نیست.');
  return { birthDate: birth || null, country: residence || null };
}
// Supabase Auth delivers both flows through the project's configured SMTP (Resend).
export function sendRecoveryCode(client, email, origin) {
  return client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: origin + '/reset-password',
  });
}
export function resendAccountCode(client, mode, email, origin) {
  return mode === 'forgot'
    ? sendRecoveryCode(client, email, origin)
    : client.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: origin + '/classic' },
      });
}
export function verifyAccountCode(client, mode, email, token) {
  return client.auth.verifyOtp({
    email: email.trim(),
    token,
    type: mode === 'forgot' ? 'recovery' : 'email',
  });
}

// Only known game destinations may follow authentication links.
export function gameReturnPath(value) {
  return typeof value === 'string' && /^\/galactic(?:\/room\/[A-Z0-9]{10})?$/.test(value)
    ? value
    : '/classic';
}
