import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'spaceborn-ecomm';
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api') || req.nextUrl.pathname.startsWith('/_next') || req.nextUrl.pathname === '/login' || req.nextUrl.pathname.startsWith('/auth') || req.nextUrl.pathname === '/unauthorized') {
    return NextResponse.next();
  }

  const sessionCookie = req.cookies.get('firebase-session')?.value;

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/auth?mode=login', req.url));
  }

  try {
    const { payload } = await jwtVerify(sessionCookie, JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    });

    if (payload.vendor !== true) {
      console.warn(`User ${payload.sub} attempted vendor access without vendor claim`);
      return NextResponse.redirect(new URL('/unauthorized', req.url));
    }

    return NextResponse.next();
  } catch (error) {
    const response = NextResponse.redirect(new URL('/auth?mode=login', req.url));
    response.cookies.delete('firebase-session');
    return response;
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
