import React from "react";
import { cn } from "@/lib/utils";

export interface GTechLogoProps {
  className?: string;
  iconClassName?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "custom";
}

const SIZE_CLASSES: Record<NonNullable<GTechLogoProps["size"]>, string> = {
  sm: "h-6 w-6",
  md: "h-7 w-7",
  lg: "h-8 w-8",
  xl: "h-10 w-10",
  custom: "",
};

/**
 * QC NetCore official brand logo and network icon.
 * Uses the official transparent G-Tech network mark (/gtech-icon.png) without any background box.
 */
export function GTechLogo({
  className,
  iconClassName,
  showText = true,
  size = "md",
}: GTechLogoProps) {
  if (!showText) {
    return (
      <img
        src="/gtech-icon.png"
        alt="QC NetCore"
        width={28}
        height={28}
        decoding="async"
        draggable={false}
        className={cn(
          "shrink-0 object-contain select-none",
          SIZE_CLASSES[size],
          iconClassName,
          className
        )}
      />
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <img
        src="/gtech-icon.png"
        alt=""
        aria-hidden="true"
        width={28}
        height={28}
        decoding="async"
        draggable={false}
        className={cn(
          "shrink-0 object-contain",
          SIZE_CLASSES[size],
          iconClassName
        )}
      />
      <span className="text-sm font-semibold leading-none tracking-tight text-foreground">
        QC <span className="font-normal text-muted-foreground">NetCore</span>
      </span>
    </span>
  );
}

