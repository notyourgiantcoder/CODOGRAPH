import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "@xyflow/react/dist/style.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codograph — Understand your codebase. Before you change it.",
  description:
    "Codograph is a concept for an AI-powered developer tool that maps code dependencies, visualizes change impact and explains unfamiliar architecture.",
};

export const viewport: Viewport = {
  themeColor: "#090a0d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
      <body className="min-h-dvh bg-bg text-fg">{children}</body>
    </html>
  );
}
