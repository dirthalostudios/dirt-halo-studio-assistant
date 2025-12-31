import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "DH Studio Assistant",
  description:
    "Neon-powered mix engineer for screams, riffs, and heavy records.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
