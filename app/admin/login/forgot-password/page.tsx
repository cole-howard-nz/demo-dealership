import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset Password — Northbridge Motors Staff Portal",
};

export default function ForgotPasswordPage() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: "#0d1a2b" }}
    >
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="absolute w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ backgroundColor: "#E15A2C" }}
      />

      <div className="relative w-full max-w-md mx-4">
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: "#111f30",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 32px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          <div className="px-8 pt-8 pb-6">
            <h1
              className="text-2xl font-bold text-white mb-1"
              style={{ fontFamily: "var(--font-sora, sans-serif)", letterSpacing: "-0.02em" }}
            >
              Reset password
            </h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              We&apos;ll email you a link to set a new one.
            </p>
          </div>

          <div style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.06)", margin: "0 2rem" }} />

          <div className="px-8 py-7">
            <ForgotPasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}
