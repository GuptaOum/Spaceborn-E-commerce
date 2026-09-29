import type { Metadata } from 'next';
import './globals.css';
import Script from 'next/script';
import { AuthProvider } from '../context/AuthContext';
import { StoreProvider } from '../context/StoreContext';
import { NextAppShell } from '../components/NextAppShell';

export const metadata: Metadata = {
  title: 'Spaceborn Express | 10-Minute Electronics & Robotics Dispatch',
  description: 'Ultra-fast electronics quick commerce. High-grade microcontrollers, sensors, motors, batteries, and robotics kits delivered in 10-15 minutes across Kanpur, Bengaluru, Noida, Pune, Delhi & Chennai.',
  keywords: ['electronics', 'robotics', 'arduino', 'raspberry pi', 'esp32', 'sensors', 'quick commerce', 'blinkit for electronics'],
  icons: {
    icon: '/spaceborn-logo.png',
  },
  openGraph: {
    title: 'Spaceborn Express - 10-Minute Electronics & Robotics Dispatch',
    description: 'Genuine maker components delivered to your lab or workbench in 10-15 minutes.',
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <StoreProvider>
            <NextAppShell>
              {children}
            </NextAppShell>
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
