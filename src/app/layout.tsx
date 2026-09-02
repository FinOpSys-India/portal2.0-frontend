import type { Metadata } from "next";
import { Inter } from "next/font/google";

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
      </body>
    </html>
  );
}
