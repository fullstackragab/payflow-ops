import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { DashboardShell } from '@/components/layout/dashboard-shell';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'PayFlow Ops | Payments Operations Dashboard',
  description:
    'Real-time payment operations monitoring, incident management, and operational insights for finance and operations teams.',
  robots: 'noindex, nofollow', // Case study, not for public indexing
};

/**
 * Root layout.
 *
 * Architecture note:
 * - suppressHydrationWarning on <html> prevents React warnings from theme script
 * - Providers wrap the entire app for MSW, theme, and query context
 * - DashboardShell provides the navigation chrome
 * - This layout applies to all routes; auth pages would use a route group with different layout
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline script to prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('payflow-theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <DashboardShell>{children}</DashboardShell>
        </Providers>
      </body>
    </html>
  );
}
