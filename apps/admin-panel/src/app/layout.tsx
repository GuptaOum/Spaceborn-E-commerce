import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { StoreProvider } from '../context/StoreContext';
import { AdminAppShell } from '../components/AdminAppShell';

export const metadata: Metadata = {
  title: 'Spaceborn Super Admin | Operations & Inventory Command',
  description: 'Enterprise operations, vendor verification, and catalog control.',
  icons: {
    icon: '/spaceborn-logo.png',
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
      </head>
      <body className="bg-[#0b0f17] text-slate-100" suppressHydrationWarning>
        <AuthProvider>
          <StoreProvider>
            <AdminAppShell>
              {children}
            </AdminAppShell>
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
