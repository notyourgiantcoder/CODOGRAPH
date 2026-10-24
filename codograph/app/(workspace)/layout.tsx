import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { buttonClass } from "@/components/ui/button-class";
import { ThemeControl } from "@/components/theme-control";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";

// Everything inside the app renders within this shell, always under an
// active organization. No organization yet means first sign-in: /start
// resolves one before the workspace is shown.
export default async function WorkspaceLayout({ children }: LayoutProps<"/">) {
  const { orgId } = await auth();
  if (!orgId) redirect("/start");

  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The landing page's navigation: a floating rounded bar, not a full-width strip. */}
      <header className="sticky top-0 z-50 shrink-0 px-3 pt-3 sm:px-4">
        <nav
          aria-label="Main"
          className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 rounded-2xl border border-line-strong bg-panel/80 px-3 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-4"
        >
          <Link href="/" className="rounded-lg" aria-label="Codograph — your analyses">
            <Wordmark />
          </Link>
          <span className="ml-1 hidden h-5 w-px bg-line-strong sm:block" aria-hidden />
          <OrganizationSwitcher
            hidePersonal
            afterSelectOrganizationUrl="/"
            afterCreateOrganizationUrl="/"
            afterLeaveOrganizationUrl="/start"
          />
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemeControl initial={theme} />
            <Link href="/" className={buttonClass("primary", "sm", "hidden h-9 sm:inline-flex")}>
              New analysis
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <UserButton />
          </div>
        </nav>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
