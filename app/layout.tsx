import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'R6 Tracker',
  description:
    'Rainbow Six Siege Spieler-Tracker — Ränge, Saison-Verlauf und Statistiken per Nutzernamen abrufen.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
