import type { Metadata } from 'next';
import { Toaster } from 'react-hot-toast';
import './globals.css';
import { AuthHydrator } from '@/components/auth-hydrator';

export const metadata: Metadata = {
  title: 'Salon Booking',
  description: 'Salon appointment & time-slot management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthHydrator />
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: '#1e293b', color: '#fff' },
          }}
        />
      </body>
    </html>
  );
}
