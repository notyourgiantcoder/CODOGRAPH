"use client";

import { MotionConfig } from "motion/react";
import { Features } from "@/components/landing/Features";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Nav } from "@/components/landing/Nav";
import { Philosophy } from "@/components/landing/Philosophy";
import { Playground } from "@/components/landing/Playground";
import { Problem } from "@/components/landing/Problem";
import { ToastProvider } from "@/components/ui/Toast";

export function LandingPage() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <a
          href="#demo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-fg focus:px-3 focus:py-2 focus:text-bg"
        >
          Skip to the interactive demo
        </a>
        <Nav />
        <main>
          <Hero />
          <Problem />
          <Features />
          <HowItWorks />
          <Philosophy />
          <Playground />
          <FinalCta />
        </main>
        <Footer />
      </ToastProvider>
    </MotionConfig>
  );
}
