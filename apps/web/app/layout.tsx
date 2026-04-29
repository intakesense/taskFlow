import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider, QueryProvider, MotionProvider, WebFeaturesProvider } from "@/components/providers";
import { BottomNavProvider } from "@taskflow/features";
import { ErrorBoundary } from "@/components/error-boundary";
import { ServiceWorkerRegister } from "@/components/pwa";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TaskFlow",
    template: "%s | TaskFlow",
  },
  description: "Hierarchical task assignment and management system",
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TaskFlow",
  },
  applicationName: "TaskFlow",
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ErrorBoundary>
          <QueryProvider>
            <ThemeProvider>
              <MotionProvider>
                <AuthProvider>
                  <WebFeaturesProvider>
                    <BottomNavProvider>
                      {children}

                      <Toaster />
                      <ServiceWorkerRegister />
                    </BottomNavProvider>
                  </WebFeaturesProvider>
                </AuthProvider>
              </MotionProvider>
            </ThemeProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
