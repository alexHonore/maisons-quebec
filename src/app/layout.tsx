import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import { EngagementBeacon } from "@/components/engagement-beacon";
import { readSiteUrl } from "@/domain/site-url";
import "./globals.css";

const sans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const display = Fraunces({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});

const site = readSiteUrl(process.env);

export const metadata: Metadata = {
  metadataBase: site,
  title: {
    default: "Maisons Québec",
    template: "%s — Maisons Québec",
  },
  applicationName: "Maisons Québec",
  authors: [{ name: "Maisons Québec" }],
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr-CA" className={`${sans.variable} ${display.variable}`}>
      <body>
        <EngagementBeacon />
        {children}
      </body>
    </html>
  );
}
