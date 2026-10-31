/**
 * TikTok Login Kit OAuth (v2). Register an app at developers.tiktok.com, add the Content Posting
 * API + Display API products, and set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, TIKTOK_REDIRECT_URI.
 * Tokens live in analytics/data/tiktok-token.json (git-ignored) and are refreshed automatically.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Fetch } from './tiktok-api';

export const SCOPES = ['user.info.basic', 'video.publish', 'video.upload', 'video.list'];
export const TOKEN_PATH = fileURLToPath(new URL('../analytics/data/tiktok-token.json', import.meta.url));
export type Token = { access_token: string; refresh_token: string; expires_at: number; refresh_expires_at: number; open_id: string; scope: string };

const env = (k: string) => { const v = process.env[k]; if (!v) throw new Error(`${k} is not set`); return v; };

export function authorizeUrl(state: string, clientKey = env('TIKTOK_CLIENT_KEY'), redirectUri = env('TIKTOK_REDIRECT_URI')): string {
  const q = new URLSearchParams({ client_key: clientKey, scope: SCOPES.join(','), response_type: 'code', redirect_uri: redirectUri, state });
  return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
}

async function tokenRequest(f: Fetch, params: Record<string, string>, now = Date.now()): Promise<Token> {
  const res = await f('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: env('TIKTOK_CLIENT_KEY'), client_secret: env('TIKTOK_CLIENT_SECRET'), ...params }).toString(),
  });
  const j = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; open_id?: string; scope?: string; error?: string; error_description?: string };
  if (!j.access_token) throw new Error(`TikTok OAuth: ${j.error ?? res.status} ${j.error_description ?? ''}`);
  return {
    access_token: j.access_token, refresh_token: j.refresh_token ?? '', open_id: j.open_id ?? '', scope: j.scope ?? '',
    expires_at: now + (j.expires_in ?? 86400) * 1000, refresh_expires_at: now + (j.refresh_expires_in ?? 0) * 1000,
  };
}

export const exchangeCode = (f: Fetch, code: string) => tokenRequest(f, { code, grant_type: 'authorization_code', redirect_uri: env('TIKTOK_REDIRECT_URI') });

export function saveToken(t: Token, path = TOKEN_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(t, null, 2));
}

/** A valid access token: env override, else the saved one (refreshed if it expires within 5 min). */
export async function accessToken(f: Fetch, path = TOKEN_PATH, now = Date.now()): Promise<string> {
  if (process.env.TIKTOK_ACCESS_TOKEN) return process.env.TIKTOK_ACCESS_TOKEN;
  if (!existsSync(path)) throw new Error('not connected to TikTok: run `npm run tiktok -- auth` first');
  const t = JSON.parse(readFileSync(path, 'utf8')) as Token;
  if (t.expires_at - now > 5 * 60 * 1000) return t.access_token;
  const fresh = await tokenRequest(f, { grant_type: 'refresh_token', refresh_token: t.refresh_token }, now);
  saveToken(fresh, path);
  return fresh.access_token;
}
