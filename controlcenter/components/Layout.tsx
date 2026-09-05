// components/Layout.tsx

// ==============================
// Imports
// ==============================
import Head from "next/head";
import type { ReactNode } from "react";

import { SITE, withBase } from "../lib/config";
import SkipLink from "./SkipLink";
import type { ReactElement } from "react";

// ==============================
// Types
// ==============================
type LayoutProps = {
  children?: ReactNode;
  /** @deprecated Containerul se aplică global din _app.tsx; acest flag este ignorat. */
  wrap?: boolean;
};

// ==============================
// Component
// ==============================
function Layout({ children }: LayoutProps): ReactElement {
  const siteName = SITE.name || "Control Center";

  return (
    <div>
      <Head>
        {/* DOAR meta globale/tehnice — SEO per pagină rămâne în <Seo /> */}
        <meta charSet="utf-8" />
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        <meta name="author" content={siteName} />

        {/* Favicons */}
        <link rel="icon" href={withBase("/favicon.png")} />
        <link rel="icon" type="image/png" sizes="32x32" href={withBase("/favicon-32x32.png")} />
        <link rel="icon" type="image/png" sizes="16x16" href={withBase("/favicon-16x16.png")} />
      </Head>

      {/* A11y: primul element focusabil pentru tastatură */}
      <SkipLink />

      {/* A11y target pentru SkipLink */}
      <main id="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

export default Layout;
