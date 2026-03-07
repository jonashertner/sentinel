import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/ui/Sidebar";
import { WelcomeOverlay } from "@/components/ui/WelcomeOverlay";
import { ThemeProvider } from "@/lib/theme-context";
import { I18nProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "SENTINEL — Swiss Epidemic Intelligence",
  description:
    "Automated global disease intelligence for Swiss public health",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-sentinel-bg text-sentinel-text min-h-screen antialiased">
        <I18nProvider>
          <ThemeProvider>
            <WelcomeOverlay />
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
            </div>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
