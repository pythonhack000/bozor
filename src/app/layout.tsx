import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n-context";
import { AuthProvider } from "@/lib/auth-context";
import { CategoriesProvider } from "@/lib/categories-context";
import { WalletProvider } from "@/lib/wallet-context";
import { ChatProvider } from "@/lib/chat-context";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AccBozor — маркетплейс игровых и Steam-аккаунтов Таджикистана",
  description:
    "AccBozor — безопасная покупка и продажа игровых и Steam-аккаунтов в Таджикистане. Мы выступаем посредником: деньги хранятся у нас до подтверждения сделки.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <I18nProvider>
          <AuthProvider>
            <WalletProvider>
              <ChatProvider>
                <CategoriesProvider>
                  <Header />
                  <main className="flex-1">{children}</main>
                  <Footer />
                </CategoriesProvider>
              </ChatProvider>
            </WalletProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
