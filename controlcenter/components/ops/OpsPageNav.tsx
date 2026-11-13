// controlcenter/components/ops/OpsPageNav.tsx

// ==============================
// Imports
// ==============================
import Link from "next/link";
import * as React from "react";

import * as n from "../../styles/ops/opsPageNav.css";

// ==============================
// Types
// ==============================
export type OpsPageNavProps = {
  cityId: string;
  current: "map" | "orders";
};

// ==============================
// Component
// ==============================
export default function OpsPageNav(props: OpsPageNavProps): React.JSX.Element {
  const { cityId, current } = props;
  const base = `/ops/${encodeURIComponent(cityId)}`;

  return (
    <nav className={n.nav} aria-label="Pagini control center">
      <Link
        href={`${base}/map`}
        className={`${n.navLink} ${current === "map" ? n.navLinkActive : ""}`}
        aria-current={current === "map" ? "page" : undefined}
      >
        Hartă
      </Link>
      <Link
        href={`${base}/orders`}
        className={`${n.navLink} ${current === "orders" ? n.navLinkActive : ""}`}
        aria-current={current === "orders" ? "page" : undefined}
      >
        Comenzi
      </Link>
    </nav>
  );
}
