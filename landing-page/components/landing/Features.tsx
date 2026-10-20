"use client";

import { FolderTree, MessagesSquare, Network, Radar, Route } from "lucide-react";
import { BlastRadiusShowcase } from "@/components/landing/features/BlastRadiusShowcase";
import { ExplorationShowcase } from "@/components/landing/features/ExplorationShowcase";
import { FeatureCard } from "@/components/landing/features/FeatureCard";
import { GroundedAnswerShowcase } from "@/components/landing/features/GroundedAnswerShowcase";
import { MappingShowcase } from "@/components/landing/features/MappingShowcase";
import { PathShowcase } from "@/components/landing/features/PathShowcase";
import { SectionHeading } from "@/components/ui/primitives";

export function Features() {
  return (
    <section id="features" className="relative py-24 sm:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px hairline-top" aria-hidden />
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
        <SectionHeading
          eyebrow="Features"
          title="One graph. Five ways to understand it."
          description="Every view below is computed live from the same synthetic repository that powers the playground further down the page."
        />

        <div className="mt-16 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-12">
          <FeatureCard
            className="lg:col-span-7"
            icon={<Network className="size-3.5" />}
            kicker="Dependency mapping"
            title="See every relationship, not just imports"
            description="Value imports, type-only imports and network calls are mapped as distinct edges, so a module's real neighbourhood is one glance away."
          >
            <MappingShowcase />
          </FeatureCard>

          <FeatureCard
            className="lg:col-span-5"
            delay={0.06}
            icon={<Radar className="size-3.5" />}
            kicker="Blast radius analysis"
            title="Know how far a change travels"
            description="Walk the graph outward from any module to find every file that transitively depends on it, grouped by hop."
          >
            <BlastRadiusShowcase />
          </FeatureCard>

          <FeatureCard
            className="lg:col-span-4"
            icon={<MessagesSquare className="size-3.5" />}
            kicker="Grounded AI explanations"
            title="Answers that cite their sources"
            description="Explanations reference the exact statements that create each relationship. Hover a citation to see it."
          >
            <GroundedAnswerShowcase />
          </FeatureCard>

          <FeatureCard
            className="lg:col-span-3"
            delay={0.06}
            icon={<FolderTree className="size-3.5" />}
            kicker="Repository exploration"
            title="Read the shape of a repo"
            description="Directory composition by module type, at a glance."
          >
            <ExplorationShowcase />
          </FeatureCard>

          <FeatureCard
            className="lg:col-span-5"
            delay={0.12}
            icon={<Route className="size-3.5" />}
            kicker="Architectural Q&A"
            title="Ask how two parts connect"
            description="Pick any two modules to trace the shortest dependency path between them, across the client/server boundary."
          >
            <PathShowcase />
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}
