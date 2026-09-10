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
