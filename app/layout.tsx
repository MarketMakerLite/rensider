import type { Metadata, Viewport } from "next";
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
  title: {
    default: "Rensider | Institutional Ownership Tracker",
    template: "%s | Rensider",
  },
  description: "Track institutional holdings from SEC 13F filings. Search by ticker symbol or fund CIK.",
  applicationName: "Rensider",
  authors: [{ name: "Rensider" }],
  generator: "Next.js",
  keywords: ["SEC filings", "13F", "institutional ownership", "hedge funds", "stock holdings", "insider trading"],
  referrer: "origin-when-cross-origin",
  creator: "Rensider",
  publisher: "Rensider",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    siteName: "Rensider",
    type: "website",
    locale: "en_US",
    title: "Rensider | Institutional Ownership Tracker",
    description: "Track institutional holdings from SEC 13F filings. Search by ticker symbol or fund CIK.",
    url: baseUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Rensider | Institutional Ownership Tracker",
    description: "Track institutional holdings from SEC 13F filings. Search by ticker symbol or fund CIK.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rensider",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "msapplication-TileColor": "#0C0A09",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F1F1" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0A09" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark light",
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
