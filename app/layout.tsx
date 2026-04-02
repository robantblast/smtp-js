import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SMTP Campaign Studio",
  description: "Structured SMTP campaigns with templated invoices"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
