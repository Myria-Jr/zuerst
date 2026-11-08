import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./style.css";
import "./expressive.css";
import { themeBootstrap } from '../lib/appearance';
import { ThemeObserver } from './appearance';
import {UpdateNotice} from './update-notice';

export const metadata: Metadata = {
  title: "Zuerst – Deine Küche. Dein Rhythmus.",
  description:
    "Dein Küchenjournal für Vorrat, Wochenplan, Einkauf und schnelle Gerichte aus deinen Zutaten.",
  applicationName: "Zuerst",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#faf8f3' }, { media: '(prefers-color-scheme: dark)', color: '#17151b' }],
  colorScheme: "light dark",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:themeBootstrap}} /></head>
      <body><ThemeObserver /><UpdateNotice />{children}</body>
    </html>
  );
}
