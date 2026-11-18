import type { Metadata } from 'next';
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
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
