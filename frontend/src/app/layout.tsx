import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/ui/Sidebar";
import { WelcomeOverlay } from "@/components/ui/WelcomeOverlay";
import { ThemeProvider } from "@/lib/theme-context";
import { I18nProvider } from "@/lib/i18n";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

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
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} bg-sentinel-bg text-sentinel-text min-h-screen antialiased`}
      >
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
