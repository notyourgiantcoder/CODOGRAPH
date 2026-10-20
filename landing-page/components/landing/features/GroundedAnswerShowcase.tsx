"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { DEPENDENCY_MAP, evidenceFor, getFile } from "@/lib/graph";

const CITATIONS = [
  "components-checkout-form->lib-validation",
  "api-checkout->lib-validation",
  "lib-validation->types-order",
].map((id) => {
  const dep = DEPENDENCY_MAP.get(id)!;
  return { dep, ...evidenceFor(dep) };
});

export function GroundedAnswerShowcase() {
  const [active, setActive] = useState<number | null>(null);
  const cite = (i: number) => (
    <button
      type="button"
      onMouseEnter={() => setActive(i)}
      onMouseLeave={() => setActive(null)}
      onFocus={() => setActive(i)}
      onBlur={() => setActive(null)}
      className={cn(
        "mx-0.5 inline-flex size-4 -translate-y-px items-center justify-center rounded align-middle font-mono text-[9.5px] font-semibold transition",
        active === i ? "bg-violet text-white" : "bg-violet/20 text-violet-soft",
      )}
      aria-label={`Source ${i + 1}`}
    >
      {i + 1}
    </button>
  );

  return (
    <div className="flex flex-1 flex-col gap-3 px-6 pb-6 sm:px-7 sm:pb-7">
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-violet/90 px-3 py-2 text-[12.5px] text-white">
        Why is validation shared between client and server?
      </div>
      <div className="rounded-xl border border-line bg-white/[0.02] p-3 text-[12.5px] leading-relaxed text-fg/90">
        <span className="font-mono text-cyan">CheckoutForm.tsx</span> validates input with{" "}
        <span className="font-mono">checkoutSchema</span> before submitting{cite(0)}, and{" "}
        <span className="font-mono text-cyan">api/checkout</span> re-checks the same schema on the server{cite(1)}. Both
        agree on shape because the schema is typed against <span className="font-mono">CheckoutInput</span>
        {cite(2)}.
      </div>
      <ul className="space-y-1.5">
        {CITATIONS.map((c, i) => (
          <li
            key={c.dep.id}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 font-mono text-[10.5px] transition",
              active === i ? "border-violet/50 bg-violet/[0.08]" : "border-line bg-black/20",
            )}
          >
            <p className="text-subtle">
              <span className="mr-1.5 text-violet-soft">[{i + 1}]</span>
              {getFile(c.dep.source).path}:{c.line}
            </p>
            <p className="mt-0.5 truncate text-fg/80">{c.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
