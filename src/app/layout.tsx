import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AuthProvider } from "@/lib/auth/auth-context";
import { CookieConsentBanner } from "@/components/legal/CookieConsentBanner";
import "./globals.css";

export const metadata: Metadata = {
  title: "QC NetCore | Billing & Network Operations",
  description: "QC NetCore Network & Billing — Carrier-Grade MikroTik, FreeRADIUS & M-Pesa SaaS Platform.",
  keywords: ["QC NetCore", "ISP Billing", "MikroTik Hotspot", "PPPoE Billing", "M-Pesa STK Push", "FreeRADIUS SaaS"],
  authors: [{ name: "QC NetCore" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/gtech-icon.png", type: "image/png", sizes: "400x400" },
    ],
    shortcut: "/gtech-icon.png",
    apple: "/gtech-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1f5fd1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('gtech_theme');
                if (t === 'light') {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                  document.documentElement.style.colorScheme = 'light';
                } else {
                  document.documentElement.classList.remove('light');
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.colorScheme = 'dark';
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="bg-background text-foreground font-sans min-h-screen flex flex-col antialiased selection:bg-primary/20 selection:text-primary">
        <ThemeProvider>
          <AuthProvider>
            {children}
            <CookieConsentBanner />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
