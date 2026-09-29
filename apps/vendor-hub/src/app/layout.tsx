import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { StoreProvider } from '../context/StoreContext';
import { VendorAppShell } from '../components/VendorAppShell';

export const metadata: Metadata = {
  title: 'Spaceborn Seller Central | Partner & Vendor Dashboard',
  description: 'Manage electronics components, live dark store inventory, and price updates across Spaceborn hubs.',
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
      <body suppressHydrationWarning>
        <AuthProvider>
          <StoreProvider>
            <VendorAppShell>
              {children}
            </VendorAppShell>
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
