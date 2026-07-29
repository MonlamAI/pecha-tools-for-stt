"use client";

// [Reason] Google login trigger for the Authorization Code Flow. Replaces the
// former auth0-js implicit flow: instead of running an OAuth client in the
// browser, the button navigates to the server login route which generates the
// CSRF state, sets HttpOnly cookies, and redirects to Google's consent screen.
import { useCallback } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Manrope, Inter } from "next/font/google";
import { FcGoogle } from "react-icons/fc";

// [Reason] Stitch "Heritage Modernist" typography: Manrope for the brand title.
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

// [Reason] Stitch body font for supporting copy and the Google CTA label.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export default function LoginClient() {
  const searchParams = useSearchParams();

  const handleGoogleLogin = useCallback(() => {
    // Preserve the intended destination across the server-driven OAuth round-trip.
    const returnTo = searchParams.get("returnTo") || "/";
    const url = `/api/auth/google/login?returnTo=${encodeURIComponent(returnTo)}`;
    window.location.href = url;
  }, [searchParams]);

  const authError = searchParams.get("error");
  // [Reason] Distinct copy when Google auth succeeds but email is not in User table.
  const authErrorMessage =
    authError === "not_allowed"
      ? "You are not allowed to log in. Please contact an administrator."
      : authError
        ? "Sign in failed. Please try again."
        : null;

  return (
    // [Reason] Full-viewport dark canvas matching the Stitch Monlam Tools login mockup.
    <div
      className={`${inter.className} fixed inset-0 z-50 flex flex-col bg-[#161b1e] text-white`}
    >
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        {/* [Reason] Brand mark above the title; white asset so it reads on the dark canvas. */}
        {/* [Reason] Larger brand mark so the logo leads the login composition. */}
        <Image
          src="/monlam-logo.png"
          alt="Monlam"
          width={128}
          height={128}
          priority
          className="mb-6 h-[128px] w-[128px] object-contain"
        />
        <h1
          className={`${manrope.className} text-[32px] font-bold leading-10 tracking-[-0.02em] text-white sm:text-[40px] sm:leading-[48px]`}
        >
          Monlam Tools
        </h1>
        <p className="mt-3 text-[15px] leading-6 text-[#8a8d90]">
          Sign in to continue
        </p>

        {authErrorMessage ? (
          <p className="mt-6 text-sm font-medium text-[#ffb4ab]">
            {authErrorMessage}
          </p>
        ) : null}

        {/* [Reason] Dark Google CTA with soft edge glow, per Stitch screen.png. */}
        <button
          id="login-btn"
          type="button"
          onClick={handleGoogleLogin}
          className="mt-10 inline-flex items-center gap-3 rounded-lg border border-[#4a5054] bg-[#2f3437] px-6 py-3.5 text-[#c6c8c9] shadow-[0_0_20px_rgba(255,255,255,0.06)] transition-colors duration-200 hover:bg-[#383d40] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8c1515]"
        >
          <FcGoogle className="text-[22px]" aria-hidden />
          <span className="text-sm font-medium tracking-wide">
            Sign in with Google
          </span>
        </button>
      </div>
    </div>
  );
}
