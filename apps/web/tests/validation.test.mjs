import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistration, validPost, sameOrigin } from '../src/lib/validation.mjs';
test('registration rejects malformed and unbounded inputs', () => {
  assert.equal(validateRegistration({ name: 'Sofia Chen', email: 'sofia@example.com', password: 'a-long-password-2026' }), true);
  for (const value of [{}, { name: 'x', email: 'no', password: 'weak' }, { name: 'Valid', email: 'x@example.com', password: 'x'.repeat(129) }, { name: 'Valid', email: {}, password: 'a-long-password-2026' }]) assert.equal(validateRegistration(value), false);
});
test('post boundary and whitespace validation', () => {
  assert.equal(validPost('a'.repeat(2000)), true);
  for (const value of ['a'.repeat(2001), '', '   ', {}, null, 123]) assert.equal(validPost(value), false);
  assert.equal(validPost('<script>alert(1)</script>'), true); // Displayed as escaped React text, never HTML.
});
test('mutation origin validation', () => {
  const req = origin => new Request('https://texa.example/api/community/posts', { headers: origin ? { origin } : {} });
  assert.equal(sameOrigin(req('https://texa.example')), true);
  assert.equal(sameOrigin(req('https://evil.example')), false);
  assert.equal(sameOrigin(req()), true); // Native/server clients still require an authenticated session.
});
test('configured public origin is authoritative behind a proxy and cannot be spoofed', () => {
  const previous = process.env.AUTH_URL;
  try {
    process.env.AUTH_URL = 'https://texa.example';
    const req = (origin, forwarded = 'evil.example') => new Request('http://0.0.0.0:3000/api/account/recovery', {
      headers: { origin, 'x-forwarded-host': forwarded, 'x-forwarded-proto': 'https' },
    });
    assert.equal(sameOrigin(req('https://texa.example')), true);
    assert.equal(sameOrigin(req('https://evil.example')), false);
    assert.equal(sameOrigin(req('http://0.0.0.0:3000')), false);
    assert.equal(sameOrigin(req('null')), false);
    process.env.AUTH_URL = 'not a valid URL';
    assert.equal(sameOrigin(req('https://texa.example')), false);
  } finally {
    if (previous === undefined) delete process.env.AUTH_URL;
    else process.env.AUTH_URL = previous;
  }
});
