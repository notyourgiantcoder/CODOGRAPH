import { SearchX } from "lucide-react";
import Link from "next/link";
import { Problem } from "@/components/ui/problem";
import { buttonClass } from "@/components/ui/button-class";

export default function NotFound() {
  return (
    <Problem
      icon={<SearchX className="size-5" aria-hidden />}
      title="Nothing here"
      actions={
        <Link href="/" className={buttonClass("primary", "sm")}>
          Back to analyses
        </Link>
      }
    >
      This analysis doesn&apos;t exist, or it belongs to another organization.
    </Problem>
  );
}
