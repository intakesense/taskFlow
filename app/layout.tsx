import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider, QueryProvider } from "@/components/providers";
import { ErrorBoundary } from "@/components/error-boundary";
import { RealtimeHealthMonitor } from "@/components/realtime-health-monitor";
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
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  robots: {
    index: false,
    follow: false,
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
      >
        <ErrorBoundary>
          <QueryProvider>
            <ThemeProvider>
              <AuthProvider>
                {children}
                <Toaster />
                <RealtimeHealthMonitor />
                <ServiceWorkerRegister />
              </AuthProvider>
            </ThemeProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
