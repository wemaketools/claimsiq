/**
 * REAL verification against the local Supabase Auth stack: the default `verifyAccessToken` with the process
 * configuration (.env.local), the cached JWKS fetched from the stack, and tokens issued by Supabase Auth itself.
 *
 * Requires `bun run supabase:start` and `bun run auth:personas`; the whole file is skipped when the stack is not
 * reachable (no Docker on the machine), and CI starts the stack first. Tokens that are validly signed but must be rejected
 * (expired, wrong issuer) are signed with the stack's own local key from `supabase/signing_keys.json`.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { verifyAccessToken } from '../../../lib/auth/verify.js';
import { getConfig, tryGetConfig } from '../../../lib/config/index.js';
import {
  decodeJwt,
  generateEs256KeyPair,
  localStackSigningKey,
  sessionClaims,
  signEs256,
  signHs256,
  tamperPayload,
  unsignedToken,
} from './jwt-helpers.js';

const PERSONA = 'head.of.claims@claimsiq.local';

async function passwordGrant(email: string, password: string): Promise<string> {
  const config = getConfig();
  const response = await fetch(`${config.supabase.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: config.supabase.anonKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`Sign-in failed (${response.status}); run bun run supabase:start and bun run auth:personas.`);
  }
  return ((await response.json()) as { access_token: string }).access_token;
}

async function stackIsReachable(): Promise<boolean> {
  const loaded = tryGetConfig();
  if (!loaded.ok) {
    return false;
  }
  try {
    const response = await fetch(`${loaded.config.supabase.url}/auth/v1/health`, {
      headers: { apikey: loaded.config.supabase.anonKey },
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const stackUp = await stackIsReachable();

let realToken: string;

beforeAll(async () => {
  if (stackUp) {
    realToken = await passwordGrant(PERSONA, 'test1234');
  }
});

describe.skipIf(!stackUp)('verifyAccessToken against local Supabase Auth', () => {
  it('accepts a token issued by Supabase Auth and rejects forged, downgraded, foreign, expired and anon-key tokens', async () => {
    const accepted = await verifyAccessToken(realToken);
    expect(accepted).toMatchObject({ ok: true, token: { email: PERSONA, algorithm: 'ES256' } });

    const { header, payload } = decodeJwt(realToken);
    const attacker = await generateEs256KeyPair('attacker-kid');
    const key = localStackSigningKey();
    const now = Math.floor(Date.now() / 1000);
    const stackHeader = { alg: 'ES256', typ: 'JWT', kid: key.kid };
    const config = getConfig();

    expect(await verifyAccessToken(tamperPayload(realToken, { email: 'finance@claimsiq.local' }))).toMatchObject({
      ok: false,
      reason: 'invalid_signature_or_expired',
    });
    expect(await verifyAccessToken(unsignedToken(payload, String(header.kid)))).toMatchObject({
      ok: false,
      reason: 'algorithm_not_allowed',
    });
    const hs256 = await signHs256({ alg: 'HS256', typ: 'JWT', kid: header.kid }, payload, config.supabase.anonKey);
    expect(await verifyAccessToken(hs256)).toMatchObject({ ok: false, reason: 'algorithm_not_allowed' });
    const unknownKey = await signEs256({ alg: 'ES256', typ: 'JWT', kid: attacker.kid }, payload, attacker.privateJwk);
    expect(await verifyAccessToken(unknownKey)).toMatchObject({ ok: false, reason: 'unknown_kid' });
    const expired = await signEs256(
      stackHeader,
      sessionClaims(config.supabase.authIssuer, { iat: now - 7200, exp: now - 5 }),
      key,
    );
    expect(await verifyAccessToken(expired)).toMatchObject({ ok: false, reason: 'invalid_signature_or_expired' });
    const foreign = await signEs256(stackHeader, sessionClaims('https://other.supabase.co/auth/v1'), key);
    expect(await verifyAccessToken(foreign)).toMatchObject({ ok: false, reason: 'issuer_mismatch' });
    expect((await verifyAccessToken(config.supabase.anonKey)).ok).toBe(false);
  });
});
