import type { Metadata } from "next";
import type { ReactNode } from "react";
import { satoshi } from "./fonts";
import "./globals.css";
import "./brand.css";

export const metadata: Metadata = {
  title: "UPCO Admin",
  description: "Centro de trabajo de UPCO",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={satoshi.variable}>
      <body>{children}</body>
    </html>
  );
}
