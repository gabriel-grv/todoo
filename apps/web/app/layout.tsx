import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { AppProviders } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Todoo",
  description: "",
};

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={poppins.className + " bg-background text-foreground min-h-screen"}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
