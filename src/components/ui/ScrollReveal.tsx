"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export type RevealVariant =
  | "fade"
  | "fade-up"
  | "fade-down"
  | "scale"
  | "metric-card"
  | "cta";

export interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  variant?: RevealVariant;
  /** When true, triggers entrance animation on mount (ideal for above-the-fold Hero elements) */
  immediate?: boolean;
  threshold?: number;
  className?: string;
}

const HIDDEN_VARIANT_CLASSES: Record<RevealVariant, string> = {
  fade: "opacity-0",
  "fade-up": "opacity-0 translate-y-6",
  "fade-down": "opacity-0 -translate-y-5",
  scale: "opacity-0 translate-y-4 scale-[0.98]",
  "metric-card": "opacity-0 translate-y-5 scale-[0.98]",
  cta: "opacity-0 translate-y-5 scale-[0.96]",
};

const VISIBLE_CLASSES = "opacity-100 translate-y-0 scale-100";

export function ScrollReveal({
  children,
  delay = 0,
  duration = 650,
  variant = "fade-up",
  immediate = false,
  threshold = 0.12,
  className = "",
}: ScrollRevealProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setReducedMotion(true);
      setIsVisible(true);
      return;
    }

    if (immediate) {
      const raf = requestAnimationFrame(() => {
        setIsVisible(true);
      });
      return () => cancelAnimationFrame(raf);
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin: "0px 0px -32px 0px" }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [immediate, threshold]);

  return (
    <div
      ref={ref}
      style={
        reducedMotion
          ? undefined
          : {
              transitionDelay: `${delay}ms`,
              transitionDuration: `${duration}ms`,
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
            }
      }
      className={cn(
        "transition-[opacity,transform] will-change-[opacity,transform]",
        isVisible ? VISIBLE_CLASSES : HIDDEN_VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </div>
  );
}

/** Alias for ScrollReveal */
export const Reveal = ScrollReveal;

export function FadeIn({
  children,
  delay = 0,
  duration = 600,
  immediate = false,
  className = "",
}: Omit<ScrollRevealProps, "variant">) {
  return (
    <ScrollReveal
      variant="fade"
      delay={delay}
      duration={duration}
      immediate={immediate}
      className={className}
    >
      {children}
    </ScrollReveal>
  );
}

export function SlideUp({
  children,
  delay = 0,
  duration = 650,
  immediate = false,
  className = "",
}: Omit<ScrollRevealProps, "variant">) {
  return (
    <ScrollReveal
      variant="fade-up"
      delay={delay}
      duration={duration}
      immediate={immediate}
      className={className}
    >
      {children}
    </ScrollReveal>
  );
}

interface StaggerContextValue {
  isVisible: boolean;
  reducedMotion: boolean;
  staggerMs: number;
  duration: number;
}

const StaggerContext = createContext<StaggerContextValue>({
  isVisible: true,
  reducedMotion: false,
  staggerMs: 80,
  duration: 600,
});

interface StaggerContainerProps {
  children: React.ReactNode;
  staggerMs?: number;
  duration?: number;
  threshold?: number;
  immediate?: boolean;
  className?: string;
}

export function StaggerContainer({
  children,
  staggerMs = 80,
  duration = 600,
  threshold = 0.12,
  immediate = false,
  className = "",
}: StaggerContainerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setReducedMotion(true);
      setIsVisible(true);
      return;
    }

    if (immediate) {
      const raf = requestAnimationFrame(() => {
        setIsVisible(true);
      });
      return () => cancelAnimationFrame(raf);
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin: "0px 0px -24px 0px" }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [immediate, threshold]);

  return (
    <StaggerContext.Provider
      value={{ isVisible, reducedMotion, staggerMs, duration }}
    >
      <div ref={ref} className={className}>
        {children}
      </div>
    </StaggerContext.Provider>
  );
}

interface StaggerItemProps {
  children: React.ReactNode;
  index?: number;
  variant?: RevealVariant;
  className?: string;
}

export function StaggerItem({
  children,
  index = 0,
  variant = "metric-card",
  className = "",
}: StaggerItemProps) {
  const { isVisible, reducedMotion, staggerMs, duration } =
    useContext(StaggerContext);

  return (
    <div
      style={
        reducedMotion
          ? undefined
          : {
              transitionDelay: `${index * staggerMs}ms`,
              transitionDuration: `${duration}ms`,
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
            }
      }
      className={cn(
        "transition-[opacity,transform] will-change-[opacity,transform]",
        isVisible ? VISIBLE_CLASSES : HIDDEN_VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </div>
  );
}
