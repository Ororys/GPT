import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import './globals.css';
// Per-request CSP nonces require dynamic rendering, including the chart benchmark.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Convergence — Votre santé, en perspective',
  description:
    'Prototype personnel descriptif. Données entièrement synthétiques. Biologie, mouvement, documents et timeline.',
  robots: { index: false, follow: false },
};
// viewport-fit=cover: the native app draws under the notch and home indicator; safe-area
// insets are applied in CSS (topbar, mobile navigation).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#101817' },
    { media: '(prefers-color-scheme: light)', color: '#f3f5f0' },
  ],
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
