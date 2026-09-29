import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@spaceborn/web-core/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'Spaceborn Seller Hub',
  description: 'Run your electronics store on Spaceborn: accept orders, manage stock, go online.',
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
