import type { ReactNode } from "react";

export const hasText = (value: string | null | undefined): value is string =>
  value !== undefined && value !== null && value !== "";

export const hasRenderableNode = (node: ReactNode): boolean => Boolean(node);

export const joinClassNames = (...classNames: (string | false)[]): string =>
  classNames.filter((className) => className !== false).join(" ");

export const minHeightStyle = (minHeight: number | undefined): { minHeight: number } | undefined =>
  minHeight === undefined || minHeight === 0 || Number.isNaN(minHeight) ? undefined : { minHeight };
