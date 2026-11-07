/**
 * Public surface of the server Supabase platform module. The SPA never imports it (lint rule + scan-bundle).
 */
export { getAdminClient, getSupabaseClient, getVerificationClient, resetSupabaseClients } from './clients.js';
export { JwksUnavailableError, createJwksCache, getJwksCache, resetJwksCaches } from './jwks.js';
export type { JWK, JwksCache, JwksCacheOptions } from './jwks.js';
