import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MAZ_OS // CONTROL DECK',
  description: 'Local-first Hermes cockpit',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ minHeight: '100vh', padding: '20px 24px' }}>
        {children}
      </body>
    </html>
  );
}
