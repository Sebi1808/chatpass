import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { cn } from "@/lib/utils";

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-sans', 
});

export const metadata: Metadata = {
  title: 'Studio Chat',
  description: 'Modulare Chat-Anwendung für interaktive Szenarien',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8F9FB' },
    { media: '(prefers-color-scheme: dark)', color: '#1A1A1A' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={cn(
        "min-h-screen bg-background font-sans antialiased",
        inter.variable
      )}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
          <Toaster />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
