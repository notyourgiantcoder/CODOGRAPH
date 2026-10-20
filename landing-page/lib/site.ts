/**
 * Site-level configuration. External links render only when configured, so
 * nothing on the page points at a placeholder URL.
 */
export const siteConfig = {
  name: "Codograph",
  tagline: "Understand your codebase. Before you change it.",
  /** Set to a repository URL to show GitHub links in the navigation and footer. */
  githubUrl: "https://github.com/notyourgiantcoder/CODOGRAPH" as string | null,
};

export const NAV_LINKS = [
  { id: "product", label: "Product" },
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How it works" },
  { id: "demo", label: "Interactive demo" },
] as const;
