"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { GithubIcon, Logo } from "@/components/landing/Brand";
import { Button } from "@/components/ui/primitives";
import { cn, scrollToId } from "@/lib/cn";
import { NAV_LINKS, siteConfig } from "@/lib/site";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Track which section is on screen to highlight its link.
  useEffect(() => {
    const sections = NAV_LINKS.map((l) => document.getElementById(l.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const go = (id: string) => {
    setOpen(false);
    scrollToId(id);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4">
      <nav
        aria-label="Main"
        className={cn(
          "mx-auto flex h-14 max-w-[1180px] items-center gap-4 rounded-2xl border px-3 transition-all duration-300 sm:px-4",
          scrolled || open
            ? "border-line-strong bg-[#0d0f13]/80 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-xl"
            : "border-transparent bg-transparent",
        )}
      >
        <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-2.5" aria-label="Codograph — back to top">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">{siteConfig.name}</span>
        </button>

        <ul className="ml-4 hidden items-center gap-0.5 md:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.id}>
              <a
                href={`#${l.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  go(l.id);
                }}
                className={cn(
                  "relative rounded-lg px-3 py-1.5 text-[13.5px] transition-colors",
                  active === l.id ? "text-fg" : "text-muted hover:text-fg",
                )}
              >
                {active === l.id && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 -z-10 rounded-lg bg-white/[0.06]"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          {siteConfig.githubUrl && (
            <a
              href={siteConfig.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden size-9 items-center justify-center rounded-lg text-muted transition hover:bg-white/[0.06] hover:text-fg sm:flex"
              aria-label="Codograph on GitHub"
            >
              <GithubIcon className="size-[18px]" />
            </a>
          )}
          <Button size="sm" className="hidden h-9 sm:inline-flex" onClick={() => go("demo")}>
            Explore the demo
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Button>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-lg text-muted transition hover:bg-white/[0.06] hover:text-fg md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="mx-auto mt-2 max-w-[1180px] overflow-hidden rounded-2xl border border-line-strong bg-[#0d0f13]/95 p-2 shadow-2xl backdrop-blur-xl md:hidden"
          >
            {NAV_LINKS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => go(l.id)}
                className="flex w-full items-center rounded-xl px-3 py-3 text-left text-[15px] text-muted transition hover:bg-white/[0.05] hover:text-fg"
              >
                {l.label}
              </button>
            ))}
            {siteConfig.githubUrl && (
              <a
                href={siteConfig.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl px-3 py-3 text-[15px] text-muted hover:bg-white/[0.05] hover:text-fg"
              >
                <GithubIcon className="size-4" /> GitHub
              </a>
            )}
            <Button className="mt-2 w-full" onClick={() => go("demo")}>
              Explore the demo
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
