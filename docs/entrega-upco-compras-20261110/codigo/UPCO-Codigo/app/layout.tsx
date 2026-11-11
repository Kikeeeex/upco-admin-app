import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UPCO | Compras y Retenciones",
  description: "Gestión de proveedores, facturas de compra, retenciones y libros de UPCO de Venezuela.",
  icons: {
    icon: "/upco-logo-green.png",
    shortcut: "/upco-logo-green.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
