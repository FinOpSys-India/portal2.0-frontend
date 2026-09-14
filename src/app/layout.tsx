import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";

import { NetworkEcho } from "@/components/dev/network-echo";
import { ECHO_ENABLED, collect } from "@/lib/dev-calls";
import { Toaster } from "@/components/ui/toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinOpSys Customer Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `suppressHydrationWarning` covers THIS ELEMENT'S OWN ATTRIBUTES AND
    // NOTHING ELSE — not its children, not its text. Browser extensions edit
    // <html> before React hydrates (a `hydrated` class, a theme attribute, a
    // scrollbar style), and React reports the difference as a mismatch the page
    // itself can never fix. A real mismatch inside the app still reports.
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* One viewport for the whole app — a write confirms from wherever it
            was made, including a dialog that closes on its way out. */}
        <Toaster />
        {/* Replays the server render's backend GETs from the browser so they
            appear in the Network tab. Renders nothing. The list has to be
            collected here, in the page's own response: a route handler is a
            different function on Vercel and never sees what the render did.
            Off unless the echo is enabled, and then it costs one promise. */}
        <Suspense>
          <NetworkEcho paths={ECHO_ENABLED ? collect() : null} />
        </Suspense>
      </body>
    </html>
  );
}
