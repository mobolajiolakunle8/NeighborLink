import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { DEFAULT_SETTINGS } from "@/lib/defaults";
import { fetchPublicSettings } from "@/lib/server-settings";

export async function generateMetadata(): Promise<Metadata> {
  const s = await fetchPublicSettings();
  const title = s?.seoTitle || DEFAULT_SETTINGS.seoTitle;
  const description = s?.seoDescription || DEFAULT_SETTINGS.seoDescription;
  return {
    title,
    description,
    openGraph: { title, description, siteName: s?.siteName || DEFAULT_SETTINGS.siteName, locale: "en_NG", type: "website" },
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex min-h-screen flex-col bg-cream text-forest antialiased">
        <Providers>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-gold focus:px-4 focus:py-2 focus:font-bold focus:text-forest">
            Skip to content
          </a>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
