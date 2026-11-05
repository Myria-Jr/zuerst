import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./style.css";

export const metadata: Metadata = {
  title: "Zuerst – Deine Küche. Dein Rhythmus.",
  description:
    "Dein Küchenjournal für Vorrat, Wochenplan, Einkauf und schnelle Gerichte aus deinen Zutaten.",
  applicationName: "Zuerst",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#f7f8fc",
  colorScheme: "light",
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
