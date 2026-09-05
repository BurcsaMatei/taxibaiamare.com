// components/CardGrid.tsx

// ==============================
// Imports
// ==============================
import { withBase } from "../lib/config";
import Card from "./Card";
import Grid from "./Grid";
import type { ReactElement } from "react";

// ==============================
// Types
// ==============================
export type GalleryCard = {
  src: string;
  alt: string;
  caption?: string;
  href?: string;
};

type Props = {
  cards: GalleryCard[];
  onItemClick?: (index: number) => void;
  aboveTheFold?: boolean;
  priorityCount?: number;
};

// ==============================
// Component
// ==============================
export default function CardGrid({
  cards,
  onItemClick,
  aboveTheFold = false,
  priorityCount = 6,
}: Props): ReactElement {
  const handleActivate = (i: number): void => onItemClick?.(i);

  return (
    <Grid gap="16px" align="stretch" justify="stretch" mode="fluid" minCol={240}>
      {cards.map((c, i) => {
        const priority = aboveTheFold && i < priorityCount;

        const interactiveProps = onItemClick
          ? ({ onClick: () => handleActivate(i) } as const)
          : c.href
            ? ({ href: withBase(c.href) } as const) // base path pentru linkuri interne
            : ({} as const);

        return (
          <div key={`${c.href ?? c.src}-${i}`}>
            <Card
              title={c.alt || "Imagine"}
              image={{ src: c.src, alt: c.alt, priority }}
              mediaRatio="4/3"
              {...(c.caption ? { excerpt: c.caption } : {})}
              {...interactiveProps}
            />
          </div>
        );
      })}
    </Grid>
  );
}
