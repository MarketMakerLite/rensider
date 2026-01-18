import type { Metadata } from "next";
import { Fira_Code, Bodoni_Moda } from "next/font/google";
import "./globals.css";

const firaCode = Fira_Code({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fira-code",
});

const bodoniModa = Bodoni_Moda({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bodoni-moda",
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
  || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "Rensider | Institutional Ownership Tracker",
  description: "Track institutional holdings from SEC 13F filings. Search by ticker symbol or fund CIK.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    siteName: "Rensider",
    type: "website",
    title: "Rensider | Institutional Ownership Tracker",
    description: "Track institutional holdings from SEC 13F filings. Search by ticker symbol or fund CIK.",
  },
  twitter: {
    card: "summary_large_image",
  },
};

// Inline script to apply font preference before render (prevents flash)
// This is a static trusted string, not user input - safe to use with dangerouslySetInnerHTML
const fontInitScript = `try{if(localStorage.getItem('font-preference')==='serif')document.body.classList.add('font-bodoni')}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${firaCode.variable} ${bodoniModa.variable}`} data-scroll-behavior="smooth">
      <body className="antialiased" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: fontInitScript }} />
        {children}
      </body>
    </html>
  );
}
