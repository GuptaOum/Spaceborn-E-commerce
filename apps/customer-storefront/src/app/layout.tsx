import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import Script from 'next/script';
import { AuthProvider } from '@spaceborn/web-core/auth';
import { StoreProvider } from '../context/StoreContext';
import { StorefrontProvider } from '../context/StorefrontConfig';
import { THEME_VARS_KEY } from '../lib/themeStorage';
import { NextAppShell } from '../components/NextAppShell';

export const metadata: Metadata = {
  title: 'Spaceborn | Electronics from shops near you',
  description: 'Hyperlocal electronics marketplace. Microcontrollers, sensors, motors and robotics parts sent by the nearest local shop with stock, in Kanpur, Bengaluru, Chennai and Pune.',
  keywords: ['electronics', 'robotics', 'arduino', 'raspberry pi', 'esp32', 'sensors', 'quick commerce', 'blinkit for electronics'],
  icons: {
    icon: '/spaceborn-logo.svg',
  },
  openGraph: {
    title: 'Spaceborn - Electronics from shops near you',
    description: 'Maker and robotics parts delivered by the nearest local shop that has them in stock.',
    url: 'https://spaceborn.in',
    siteName: 'Spaceborn Express',
    images: [
      {
        url: 'https://res.cloudinary.com/kpa1wv3h/image/upload/v1783382894/spaceborn_assets/spaceborn-transparent-logo.png',
        width: 800,
        height: 600,
      },
    ],
    locale: 'en_IN',
    type: 'website',
  },
};

// Applies the last published theme before first paint, so returning visitors never see the
// default colours flash. Only well-formed colour variables are accepted from storage.
const THEME_BOOT = `try{var v=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_VARS_KEY)})||'null');if(v){for(var k in v){if(/^--color-sb-[a-z-]+$/.test(k)&&/^#[0-9a-fA-F]{6}$/.test(v[k]))document.documentElement.style.setProperty(k,v[k]);}}}catch(e){}`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <StorefrontProvider>
            <StoreProvider>
              <NextAppShell>
                {children}
              </NextAppShell>
            </StoreProvider>
          </StorefrontProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
