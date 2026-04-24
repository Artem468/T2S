import type { Metadata } from "next";
import { Geologica, Montserrat } from "next/font/google";
import "./globals.css";

const geologica = Geologica({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geologica",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  variable: "--font-montserrat",
  display: "swap",
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
    <html
      lang="ru"
      className={`${geologica.variable} ${montserrat.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
