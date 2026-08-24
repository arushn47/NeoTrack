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
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host;
  const proto = request.headers.get('x-forwarded-proto') || (url.protocol.replace(':', '')) || 'https';
  return `${proto}://${host}`;
}

/**
 * Gets the Google OAuth redirect URI to use for the authorization request.
 * Automatically avoids localhost redirect URIs when running on a live deployed domain.
 */
export function getOAuthRedirectUri(request: Request): string {
  const origin = getBaseUrl(request);
  const configuredUri = process.env.GOOGLE_REDIRECT_URI;

  if (configuredUri) {
    // If GOOGLE_REDIRECT_URI is set to localhost but request is on a deployed/production domain, use dynamic origin
    if (configuredUri.includes('localhost') && !origin.includes('localhost')) {
      return `${origin}/api/auth/callback`;
    }
    return configuredUri;
  }

  return `${origin}/api/auth/callback`;
}

/**
 * Gets the application URL for redirects after authentication or error handling.
 * Automatically avoids localhost URLs when running on a live deployed domain.
 */
export function getAppUrl(request: Request): string {
  const origin = getBaseUrl(request);
  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (configuredAppUrl) {
    if (configuredAppUrl.includes('localhost') && !origin.includes('localhost')) {
      return origin;
    }
    return configuredAppUrl;
  }

  return origin;
}
