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
