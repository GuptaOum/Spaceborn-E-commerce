import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@spaceborn/web-core/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'Spaceborn Admin',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
