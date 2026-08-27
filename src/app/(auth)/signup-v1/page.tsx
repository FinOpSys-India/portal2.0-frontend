import type { Metadata } from "next";

import { SignupV1Form } from "./signup-v1-form";

export const metadata: Metadata = {
  title: "SignUp - FinOpSys Customer Portal",
};

/**
 * Portal 1.0's signup screen, reproduced.
 *
 * Reference build, sibling to /login-v1. Same 51/49 split, same field metrics,
 * measured off the live app at 1763x930 — see docs/design-tokens.md and
 * docs/customer-onboarding.md.
 *
 * Shares no components with the redesign, on purpose: changing the design
 * system must not silently alter the reference.
 */
export default async function SignupV1Page({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
  }>;
}) {
  const { token, email, firstName, lastName } = await searchParams;

  return (
    <div className="flex min-h-screen bg-white">
      <div className="flex flex-1 flex-col px-6 py-[74px] lg:basis-[51%] lg:px-[83px]">
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
            <SignupV1Form
              invite={{
                token: token ?? "",
                email: email ?? "",
                firstName: firstName ?? "",
                lastName: lastName ?? "",
              }}
            />
          </div>
        </div>
      </div>

      {/* 1.0: full-bleed artwork, headline baked into the image. */}
      <div className="relative hidden lg:block lg:basis-[49%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/signup.jpg"
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      </div>
    </div>
  );
}
