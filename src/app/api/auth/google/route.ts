import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { getOAuthRedirectUri } from '@/lib/auth';

/**
 * GET /api/auth/google
 * 
 * Redirects the user to Google's OAuth consent screen.
 * Query param: ?type=personal|college (to track which account is being connected)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountType = searchParams.get('type') || 'personal';

  const redirectUri = getOAuthRedirectUri(request);

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.readonly',
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: JSON.stringify({ account_type: accountType }),
    include_granted_scopes: true,
  });

  return NextResponse.redirect(authUrl);
}
