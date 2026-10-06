"use client";

import { useEffect, useState } from "react";

export const ALLOWED_PAGE_SIZES = [10, 25, 50, 100] as const;
export type PageSizeOption = (typeof ALLOWED_PAGE_SIZES)[number];

export const DEFAULT_PAGE_SIZE: PageSizeOption = 25;
const STORAGE_KEY = "gtech_page_size";
const EVENT_NAME = "gtech:preferences-changed";

export function getStoredPageSize(): PageSizeOption {
  if (typeof window === "undefined") return DEFAULT_PAGE_SIZE;
  try {
    const raw = Number(window.localStorage.getItem(STORAGE_KEY));
    if (ALLOWED_PAGE_SIZES.includes(raw as PageSizeOption)) {
      return raw as PageSizeOption;
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_PAGE_SIZE;
}

export function setStoredPageSize(size: PageSizeOption): void {
  if (typeof window === "undefined") return;
  if (!ALLOWED_PAGE_SIZES.includes(size)) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(size));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { pageSize: size } }));
  } catch {
    // ignore storage errors
  }
}

export function usePageSize(): [PageSizeOption, (size: PageSizeOption) => void] {
  const [pageSize, setPageSizeState] = useState<PageSizeOption>(DEFAULT_PAGE_SIZE);

  useEffect(() => {
    setPageSizeState(getStoredPageSize());
    const onUpdate = () => setPageSizeState(getStoredPageSize());
    window.addEventListener(EVENT_NAME, onUpdate);
    window.addEventListener("storage", onUpdate);
    return () => {
      window.removeEventListener(EVENT_NAME, onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, []);

  const update = (next: PageSizeOption) => {
    setStoredPageSize(next);
    setPageSizeState(next);
  };

  return [pageSize, update];
}
