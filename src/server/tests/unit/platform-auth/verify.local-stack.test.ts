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
  it('accepts a token issued by local Supabase Auth for a demo persona', async () => {
    // Act
    const result = await verifyAccessToken(realToken);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.token.email).toBe(PERSONA);
      expect(result.token.algorithm).toBe('ES256');
    }
  });

  it('rejects the real token with a tampered payload (forged identity)', async () => {
    const result = await verifyAccessToken(tamperPayload(realToken, { email: 'finance@claimsiq.local' }));
    expect(result).toMatchObject({ ok: false, reason: 'invalid_signature_or_expired' });
  });

  it('rejects the real claims re-issued with alg none', async () => {
    const { header, payload } = decodeJwt(realToken);
    const result = await verifyAccessToken(unsignedToken(payload, String(header.kid)));
    expect(result).toMatchObject({ ok: false, reason: 'algorithm_not_allowed' });
  });

  it('rejects the real claims re-signed with HS256 using the anon key as the secret', async () => {
    const { header, payload } = decodeJwt(realToken);
    const token = await signHs256({ alg: 'HS256', typ: 'JWT', kid: header.kid }, payload, getConfig().supabase.anonKey);
    await expect(verifyAccessToken(token)).resolves.toMatchObject({ ok: false, reason: 'algorithm_not_allowed' });
  });

  it('rejects a token signed by an unknown key with an unknown kid', async () => {
    const attacker = await generateEs256KeyPair('attacker-kid');
    const { payload } = decodeJwt(realToken);
    const token = await signEs256({ alg: 'ES256', typ: 'JWT', kid: attacker.kid }, payload, attacker.privateJwk);
    await expect(verifyAccessToken(token)).resolves.toMatchObject({ ok: false, reason: 'unknown_kid' });
  });

  it('rejects an expired token signed with the stack key', async () => {
    // Arrange
    const key = localStackSigningKey();
    const now = Math.floor(Date.now() / 1000);
    const token = await signEs256(
      { alg: 'ES256', typ: 'JWT', kid: key.kid },
      sessionClaims(getConfig().supabase.authIssuer, { iat: now - 7200, exp: now - 5 }),
      key,
    );

    // Act
    const result = await verifyAccessToken(token);

    // Assert
    expect(result).toMatchObject({ ok: false, reason: 'invalid_signature_or_expired' });
  });

  it('rejects a token signed with the stack key but carrying a foreign issuer', async () => {
    const key = localStackSigningKey();
    const token = await signEs256({ alg: 'ES256', typ: 'JWT', kid: key.kid }, sessionClaims('https://other.supabase.co/auth/v1'), key);
    await expect(verifyAccessToken(token)).resolves.toMatchObject({ ok: false, reason: 'issuer_mismatch' });
  });

  it('rejects the anon key, which is not a user session', async () => {
    const result = await verifyAccessToken(getConfig().supabase.anonKey);
    expect(result.ok).toBe(false);
  });
});
