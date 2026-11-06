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
import { getConfig } from '../../../lib/config/index.js';
import { passwordGrant, stackIsReachable } from '../../helpers/localStack.js';
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

const stackUp = await stackIsReachable();

let realToken: string;

beforeAll(async () => {
  if (stackUp) {
    realToken = await passwordGrant(PERSONA);
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
