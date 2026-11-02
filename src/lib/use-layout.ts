"use client";

import { useSyncExternalStore } from "react";

/** 4장 레이아웃: 화면 너비만으로 나눈다 */
export type Layout = "phone" | "pad" | "land" | "pc";

const QUERIES: [Layout, string][] = [
  ["pc", "(min-width: 1280px)"],
  ["land", "(min-width: 1024px)"],
  ["pad", "(min-width: 744px)"],
];

function current(): Layout {
  for (const [layout, q] of QUERIES) if (window.matchMedia(q).matches) return layout;
  return "phone";
}

function subscribe(callback: () => void) {
  const lists = QUERIES.map(([, q]) => window.matchMedia(q));
  for (const l of lists) l.addEventListener("change", callback);
  return () => {
    for (const l of lists) l.removeEventListener("change", callback);
  };
}

export function useLayout(): Layout {
  return useSyncExternalStore(subscribe, current, () => "phone");
}
