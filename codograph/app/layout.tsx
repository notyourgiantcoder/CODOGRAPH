import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Pages name themselves; the template adds the product after.
  title: { default: "Codograph — Understand your codebase. Before you change it.", template: "%s · Codograph" },
  description: "Dependency maps of public GitHub repositories",
};

// Clerk's components read the same tokens as the app, so they follow the
// theme control instead of the OS.
const clerkAppearance = {
  variables: {
    colorBackground: "var(--surface)",
    colorForeground: "var(--fg)",
    colorMutedForeground: "var(--fg-muted)",
    // A fixed colour, not a variable: Clerk derives its button shades from it.
    // White on this violet holds 5.7:1 in either theme.
    colorPrimary: "#7c3aed",
    colorPrimaryForeground: "#ffffff",
    colorInput: "var(--canvas)",
    colorInputForeground: "var(--fg)",
    colorNeutral: "var(--fg)",
    colorBorder: "var(--line)",
    fontFamily: "var(--font-geist-sans)",
    fontSize: "0.8125rem",
    borderRadius: "0.75rem",
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full flex-col">
        <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>
      </body>
    </html>
  );
}
