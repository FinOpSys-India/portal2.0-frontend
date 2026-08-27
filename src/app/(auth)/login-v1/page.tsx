import type { Metadata } from "next";

import { LoginV1Form } from "./login-v1-form";

export const metadata: Metadata = {
  title: "Login – FinOpSys Customer Portal",
};

/**
 * Portal 1.0's login screen, reproduced.
 *
 * This is the reference build — a straight port of what Bubble renders, kept
 * alongside the redesigned `/` so the two can be compared. Every number here
 * was measured off the live app at 1763x930; see docs/design-tokens.md.
 *
 * Nothing in this route shares components with the redesign, on purpose:
 * changing the design system must not silently alter the reference.
 */
export default function LoginV1Page() {
  return (
    <div className="flex min-h-screen bg-white">
      <div className="flex flex-1 flex-col px-6 py-[74px] lg:basis-[51%] lg:px-[83px]">
        {/* 1.0: 139x42 at (83, 74). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/logo.svg"
          alt="FinOpSys"
          width={139}
          height={42}
          className="h-[42px] w-[139px]"
        />

        <div className="flex flex-1 items-center">
          <div className="w-full max-w-[677px] pb-5">
            <LoginV1Form />
          </div>
        </div>
      </div>

      {/* 1.0: full-bleed artwork, headline baked into the PNG. */}
      <div className="relative hidden lg:block lg:basis-[49%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/login.png"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      </div>
    </div>
  );
}
