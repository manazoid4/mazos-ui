import type { Metadata } from 'next';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'MAZ_OS // CONTROL DECK',
  description: 'Local-first Hermes cockpit',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body style={{ minHeight: '100vh', padding: '20px 24px' }}>
        {children}
      </body>
    </html>
  );
}
