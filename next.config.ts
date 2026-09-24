import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the home directory makes Next guess the wrong root.
  turbopack: { root: __dirname },

  // Server components fetch the backend node-to-node, so those calls never
  // appear in the browser's Network tab. This prints them — full URL, status,
  // duration — to the `next dev` terminal instead. Dev-only; ignored in a build.
  logging: { fetches: { fullUrl: true } },

  /**
   * 1.0's misspelled workspace picker, kept alive.
   *
   * The route is /company_select now. This is what stops every bookmark, email
   * link and pasted URL carrying the old spelling from 404ing.
   *
   * `permanent: true` is a 308, not a 301: a 301 lets browsers rewrite the
   * method to GET, and 308 is the code that does not. Config redirects run
   * BEFORE the proxy (headers → redirects → proxy → filesystem), so an old link
   * is corrected before the auth guard reads the path — a signed-out visitor
   * gets sent to /login with `next=/company_select`, not with the typo.
   *
   * Query strings ride along automatically.
   */
  /**
   * Baseline response headers. There were none before, which on a portal
   * holding client financials is mostly about the first one.
   *
   * X-Frame-Options stops the app being framed, which is the difference
   * between a clickjack being possible and not: an attacker overlays an
   * invisible iframe of a real page and harvests clicks on real buttons, with
   * a real session behind them. `DENY` rather than SAMEORIGIN — nothing here
   * frames itself.
   *
   * NO CONTENT-SECURITY-POLICY YET, deliberately. Next's bootstrap and its
   * inline style injection need a nonce to survive one, a wrong policy breaks
   * the app in the browser with nothing in the build to warn you, and it wants
   * testing on a preview rather than being smuggled in beside four headers
   * that cannot break anything.
   *
   * ponytail: no CSP, no Permissions-Policy. Add the CSP with a nonce via
   * middleware when someone can watch a preview while it lands.
   */
  headers() {
    return Promise.resolve([
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          /*
           * Two years and subdomains, no `preload`. Preload is the one that is
           * effectively irreversible — it ships in browser binaries and is
           * slow to undo — and it is not ours to opt into on a domain the
           * company uses for other things.
           */
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ]);
  },

  redirects() {
    return Promise.resolve([
      {
        source: "/comany_select",
        destination: "/company_select",
        permanent: true,
      },
    ]);
  },
};

export default nextConfig;
