"use client";

import { GithubIcon, Logo } from "@/components/landing/Brand";
import { scrollToId } from "@/lib/cn";
import { NAV_LINKS, siteConfig } from "@/lib/site";

const EXTRA_LINKS = [{ id: "insights", label: "Repository insights" }] as const;

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-10 px-4 py-12 sm:px-6 md:flex-row md:justify-between">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="text-[15px] font-semibold tracking-tight">{siteConfig.name}</span>
          </div>
          <p className="mt-4 text-[13.5px] leading-relaxed text-muted">{siteConfig.tagline}</p>
          <p className="mt-3 text-[12px] leading-relaxed text-subtle">
            A product concept. Every demo on this page runs client-side on synthetic data. No repositories are analysed and
            no language model is called.
          </p>
        </div>

        <nav aria-label="Footer" className={siteConfig.githubUrl ? "grid grid-cols-2 gap-10 text-[13.5px]" : "text-[13.5px]"}>
          <div>
            <p className="font-medium text-fg">Explore</p>
            <ul className="mt-3 space-y-2">
              {[...NAV_LINKS, ...EXTRA_LINKS].map((l) => (
                <li key={l.id}>
                  <a
                    href={`#${l.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToId(l.id);
                    }}
                    className="text-muted transition hover:text-fg"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          {siteConfig.githubUrl && (
            <div>
              <p className="font-medium text-fg">Source</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <a href={siteConfig.githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-muted transition hover:text-fg">
                    <GithubIcon className="size-4" /> GitHub
                  </a>
                </li>
              </ul>
            </div>
          )}
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-[1180px] px-4 py-6 text-[12px] text-subtle sm:px-6">
          © {siteConfig.name}. Illustrative product concept built with synthetic data.
        </p>
      </div>
    </footer>
  );
}
