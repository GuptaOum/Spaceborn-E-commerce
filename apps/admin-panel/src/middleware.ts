import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';

// Firebase token verification using Jose to run on Edge runtime
// We fetch the Google public keys to verify the JWT signature.
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'spaceborn-ecomm';
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export async function middleware(req: NextRequest) {
  // Exclude API routes, static files, login/auth page, and unauthorized page
  if (req.nextUrl.pathname.startsWith('/api') || req.nextUrl.pathname.startsWith('/_next') || req.nextUrl.pathname === '/login' || req.nextUrl.pathname.startsWith('/auth') || req.nextUrl.pathname === '/unauthorized') {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get('firebase-session')?.value;

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/auth?mode=login', req.url));
  }

  try {
    // Verify the JWT (which is stored in the cookie by our custom login route)
    const { payload } = await jwtVerify(sessionCookie, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });

    // Check if the user has the admin claim
    if (payload.admin !== true) {
      console.warn(`User ${payload.sub} attempted admin access without admin claim`);
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Session verification failed:', error);
    // Invalid or expired token
    const response = NextResponse.redirect(new URL('/auth?mode=login', req.url));
    response.cookies.delete('firebase-session');
    return response;
  }
}

// Ensure the middleware only runs on specific paths
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
