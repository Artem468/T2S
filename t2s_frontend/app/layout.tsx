import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const futuraRound = localFont({
  src: "../public/afuturaround.ttf",
  variable: "--font-futuraround",
});

export const metadata: Metadata = {
  title: "T2S",
  description: "Сервис преобразования текста в SQL",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${futuraRound.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
