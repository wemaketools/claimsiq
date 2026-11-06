/**
 * Unit tests of src/server/lib/auth/verify.ts with locally generated keys (no network): every check of the verifier
 * in order, including forged, expired, `alg: none` and HS256 downgrade tokens.
 */
import { createClient } from '@supabase/supabase-js';
import type { JWK } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createTokenVerifier,
  extractBearerToken,
  supabaseClaimsVerifier,
} from '../../../lib/auth/verify.js';
import type { VerifyDeps } from '../../../lib/auth/verify.js';
import {
  base64url,
  generateEs256KeyPair,
  sessionClaims,
  signEs256,
  signHs256,
  tamperPayload,
  unsignedToken,
} from './jwt-helpers.js';
import type { TestKeyPair } from './jwt-helpers.js';

const ISSUER = 'http://auth.test/auth/v1';
// The verification client is only used with an explicit key set, so it never calls this URL.
const client = createClient('http://auth.test', 'test-anon-key', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

let trusted: TestKeyPair;
let attacker: TestKeyPair;

beforeAll(async () => {
  trusted = await generateEs256KeyPair('trusted-kid');
  attacker = await generateEs256KeyPair('attacker-kid');
});

function depsWith(keys: Record<string, JWK>): VerifyDeps & { getKey: ReturnType<typeof vi.fn> } {
  const getKey = vi.fn(async (kid: string) => keys[kid] ?? null);
  return { getKey, verifyClaims: supabaseClaimsVerifier(client), issuer: ISSUER };
}

describe('createTokenVerifier', () => {
  it('accepts a valid ES256 session token and returns the subject and lower-cased email', async () => {
    const verify = createTokenVerifier(depsWith({ [trusted.kid]: trusted.publicJwk }));
    const token = await signEs256(
      { alg: 'ES256', typ: 'JWT', kid: trusted.kid },
      sessionClaims(ISSUER, { email: 'Head.Of.Claims@ClaimsIQ.local' }),
      trusted.privateJwk,
    );

    const result = await verify(token);

    expect(result).toMatchObject({
      ok: true,
      token: {
        email: 'head.of.claims@claimsiq.local',
        authUserId: '6f1c2a54-2f36-4d4f-9a55-0c7d2b8e1a10',
        algorithm: 'ES256',
      },
    });
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    expect(extractBearerToken('Basic abc')).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('rejects bad tokens with the right reason, and never looks up a key for the ones it can refuse by shape', async () => {
    const deps = depsWith({ [trusted.kid]: trusted.publicJwk });
    const verify = createTokenVerifier(deps);
    const header = { alg: 'ES256', typ: 'JWT', kid: trusted.kid };
    const now = Math.floor(Date.now() / 1000);
    const valid = await signEs256(header, sessionClaims(ISSUER), trusted.privateJwk);
    const sign = (overrides: Record<string, unknown>) =>
      signEs256(header, sessionClaims(ISSUER, overrides), trusted.privateJwk);

    const refusedByShape: Array<[string, string | null, string]> = [
      ['no token', null, 'missing_token'],
      ['one segment', 'abc', 'malformed'],
      ['a header that is a JSON array', `${base64url('[1]')}.${base64url('{}')}.c2ln`, 'malformed'],
      ['alg none', unsignedToken(sessionClaims(ISSUER), trusted.kid), 'algorithm_not_allowed'],
      [
        'an HS256 downgrade',
        await signHs256({ alg: 'HS256', typ: 'JWT', kid: trusted.kid }, sessionClaims(ISSUER), 'guess'),
        'algorithm_not_allowed',
      ],
    ];
    for (const [label, token, reason] of refusedByShape) {
      expect(await verify(token), label).toMatchObject({ ok: false, reason });
    }
    expect(deps.getKey).not.toHaveBeenCalled();

    const refusedAfterLookup: Array<[string, string, string]> = [
      [
        'an unknown kid',
        await signEs256({ alg: 'ES256', typ: 'JWT', kid: attacker.kid }, sessionClaims(ISSUER), attacker.privateJwk),
        'unknown_kid',
      ],
      [
        'no kid',
        await signEs256({ alg: 'ES256', typ: 'JWT' }, sessionClaims(ISSUER), trusted.privateJwk),
        'unknown_kid',
      ],
      [
        'another key under the trusted kid',
        await signEs256(header, sessionClaims(ISSUER), attacker.privateJwk),
        'invalid_signature_or_expired',
      ],
      [
        'a tampered payload',
        tamperPayload(valid, { email: 'finance@claimsiq.local' }),
        'invalid_signature_or_expired',
      ],
      ['an expired token', await sign({ iat: now - 7200, exp: now - 60 }), 'invalid_signature_or_expired'],
      [
        'another issuer',
        await signEs256(header, sessionClaims('http://evil.test/auth/v1'), trusted.privateJwk),
        'issuer_mismatch',
      ],
      ['role anon', await sign({ role: 'anon' }), 'invalid_claims'],
      ['role service_role', await sign({ role: 'service_role' }), 'invalid_claims'],
      ['an empty subject', await sign({ sub: '' }), 'invalid_claims'],
      [
        'an RS256 header on an EC key',
        `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: trusted.kid }))}.${base64url(JSON.stringify(sessionClaims(ISSUER)))}.${base64url('signature')}`,
        'key_mismatch',
      ],
    ];
    for (const [label, token, reason] of refusedAfterLookup) {
      expect(await verify(token), label).toMatchObject({ ok: false, reason });
    }
  });

  it('reports jwks_unavailable when the key set cannot be loaded', async () => {
    const { JwksUnavailableError } = await import('../../../lib/supabase/jwks.js');
    const verify = createTokenVerifier({
      getKey: async () => {
        throw new JwksUnavailableError('down');
      },
      verifyClaims: supabaseClaimsVerifier(client),
      issuer: ISSUER,
    });
    const token = await signEs256(
      { alg: 'ES256', typ: 'JWT', kid: trusted.kid },
      sessionClaims(ISSUER),
      trusted.privateJwk,
    );

    await expect(verify(token)).resolves.toMatchObject({ ok: false, reason: 'jwks_unavailable' });
  });
});
