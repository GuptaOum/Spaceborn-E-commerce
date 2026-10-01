import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProvider } from '@spaceborn/web-core/auth';
import { FeedbackProvider } from '@spaceborn/web-core/feedback';
import './globals.css';

export const metadata: Metadata = {
  title: 'Spaceborn Admin',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <FeedbackProvider>{children}</FeedbackProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
