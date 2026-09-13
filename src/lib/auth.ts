import { cookies } from 'next/headers';
import * as jose from 'jose';

export interface SessionPayload {
  userId: string;
  email: string;
  name: string | null;
  avatar: string | null;
}

/**
 * Gets the current user session from the HTTP-only cookie.
 * Returns null if no valid session exists.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;

  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(process.env.TOKEN_ENCRYPTION_KEY);
    const { payload } = await jose.jwtVerify(token, secret);

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: (payload.name as string) || null,
      avatar: (payload.avatar as string) || null,
    };
  } catch {
    return null;
  }
}

/**
 * Requires a valid session — throws a redirect to login if not authenticated.
 * Use in Server Components.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    // Dynamic import to avoid circular dependency
    const { redirect } = await import('next/navigation');
    redirect('/login');
    throw new Error('Redirecting...');
  }
  return session;
}

/**
 * Resolves the base URL / origin of the incoming request.
 * Handles reverse proxy headers (e.g., Vercel, Cloudflare).
 */
export function getBaseUrl(request: Request): string {
  const url = new URL(request.url);
  const rawHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host;
  const rawProto = request.headers.get('x-forwarded-proto') || (url.protocol.replace(':', '')) || 'https';
  
  // Clean up if forwarded headers contain multiple comma-separated values
  const host = rawHost.split(',')[0].trim();
  const proto = rawProto.split(',')[0].trim();
  
  return `${proto}://${host}`;
}

/**
 * Gets the Google OAuth redirect URI to use for the authorization request.
 * Automatically avoids localhost redirect URIs or mismatched domain URIs when running on a live deployed domain.
 */
export function getOAuthRedirectUri(request: Request): string {
  const origin = getBaseUrl(request);
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return `${origin}/api/auth/callback`;
  }
  return 'https://www.wheresmyoffer.in/api/auth/callback';
}

export function getAppUrl(request: Request): string {
  const origin = getBaseUrl(request);
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return origin;
  }
  return 'https://www.wheresmyoffer.in';
}
