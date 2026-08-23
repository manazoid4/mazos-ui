import type { Metadata } from 'next';
import './globals.css';
import { Geist } from 'next/font/google';
import { cn } from '@/lib/utils';
import { DesktopRuntimeBoundary } from '@/components/DesktopRuntimeBoundary';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'MAZos · Maz Works Call Desk',
  description: 'Local operator console for bounded work, evidence-led client calls, approvals and receipts',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable)}>
      <body style={{ minHeight: '100vh', padding: '20px 24px' }}>
        <DesktopRuntimeBoundary>{children}</DesktopRuntimeBoundary>
      </body>
    </html>
  );
}
