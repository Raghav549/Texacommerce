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
