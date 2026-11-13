// controlcenter/pages/ops/[cityId]/orders.tsx

// ==============================
// Imports
// ==============================
import type { NextPage } from "next";
import { useRouter } from "next/router";
import * as React from "react";

import OpsOrdersPage from "../../../components/ops/orders/OpsOrdersPage";

// ==============================
// Utils
// ==============================
function toCitySlug(raw: string): string {
  const s0 = raw.trim().toLowerCase();
  if (!s0) return "";

  // normalize diacritics (Edge/Chromium OK)
  const s1 = s0.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // keep [a-z0-9 - _], convert others to space
  const s2 = s1.replace(/[^a-z0-9\s_-]/g, " ");

  // spaces/underscores -> hyphen, collapse repeats
  const s3 = s2.replace(/[\s_]+/g, "-").replace(/-+/g, "-");

  // trim hyphens
  return s3.replace(/^-+/, "").replace(/-+$/, "");
}

// ==============================
// Component
// ==============================
const OpsCityOrdersPage: NextPage = () => {
  const router = useRouter();

  const cityParam = typeof router.query.cityId === "string" ? router.query.cityId : "";
  const cityId = toCitySlug(cityParam);

  if (!cityId) return <div />;

  return <OpsOrdersPage cityId={cityId} />;
};

// ==============================
// Exporturi
// ==============================
export default OpsCityOrdersPage;
