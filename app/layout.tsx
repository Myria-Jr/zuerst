import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './style.css';

export const metadata: Metadata = {
  title: 'Zuerst – Aufbrauchen und loskochen',
  description: 'Wähle, was wegmuss. Zuerst findet ein Gericht aus deinen Zutaten, das in höchstens 20 Minuten fertig ist.',
  applicationName: 'Zuerst',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
};

export const viewport: Viewport = { themeColor: '#f7f3e9', colorScheme: 'light' };

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="de"><body>{children}</body></html>;
}
