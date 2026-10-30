import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  profileDetails,
  sendRecoveryCode,
  resendAccountCode,
  verifyAccountCode,
} from '../lib/classic/account.mjs';
test('birth date and residence are optional, may be cleared, and reject invalid input', () => {
  assert.deepEqual(profileDetails({}), { birthDate: null, country: null });
  assert.deepEqual(profileDetails({ birthDate: '1996-02-29', country: ' ایران ' }), {
    birthDate: '1996-02-29',
    country: 'ایران',
  });
  for (const birthDate of ['1995-02-29', '2020-02-31', '2999-01-01', 'not-a-date'])
    assert.throws(() => profileDetails({ birthDate }));
  assert.throws(() => profileDetails({ country: '<invalid>' }));
});
test('initial and repeated recovery use the same Supabase SMTP path and redirect', async () => {
  const calls = [];
  const client = {
    auth: {
      resetPasswordForEmail: async (...args) => {
        calls.push(args);
        return { error: null };
      },
    },
  };
  await sendRecoveryCode(client, ' test@example.com ', 'https://farsidle.com');
  await resendAccountCode(client, 'forgot', 'test@example.com', 'https://farsidle.com');
  assert.deepEqual(calls[0], [
    'test@example.com',
    { redirectTo: 'https://farsidle.com/reset-password' },
  ]);
  assert.deepEqual(calls[0], calls[1]);
});
test('signup resends and verification keep signup and recovery code types separate', async () => {
  const calls = [];
  const client = {
    auth: {
      resend: async (p) => {
        calls.push(p);
        return { error: null };
      },
      verifyOtp: async (p) => {
        calls.push(p);
        return { error: null };
      },
    },
  };
  await resendAccountCode(client, 'register', 'test@example.com', 'https://farsidle.com');
  assert.deepEqual(calls[0], {
    type: 'signup',
    email: 'test@example.com',
    options: { emailRedirectTo: 'https://farsidle.com/classic' },
  });
  await verifyAccountCode(client, 'register', 'test@example.com', '123456');
  assert.equal(calls[1].type, 'email');
  await verifyAccountCode(client, 'forgot', 'test@example.com', '123456');
  assert.equal(calls[2].type, 'recovery');
});

import { gameReturnPath } from '../lib/classic/account.mjs';
test('authentication preserves game invitations and rejects external return URLs', () => {
  assert.equal(gameReturnPath('/galactic/room/386710A103'), '/galactic/room/386710A103');
  assert.equal(gameReturnPath('/galactic'), '/galactic');
  for (const bad of [
    'https://evil.example',
    '//evil.example',
    '/galactic/../profile',
    '/galactic?next=//evil.example',
    null,
    ['/galactic'],
  ])
    assert.equal(gameReturnPath(bad), '/classic');
});
