import type { Metadata } from "next";
import { prisma } from "../../../../lib/prisma";
import { resetPassword } from "../actions";
import { ResetPasswordForm } from "./ResetPasswordForm";
import Link from "next/link";
import { XCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Set New Password — Northbridge Motors Staff Portal",
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function ResetPasswordPage({ params }: PageProps) {
  const { token } = await params;

  const record = await prisma.passwordResetToken.findFirst({
    where: {
      token,
      used: false,
      expires: { gt: new Date() },
    },
    select: { id: true },
  });

  const boundAction = resetPassword.bind(null, token);

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
              Set new password
            </h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              Choose a strong password of at least 12 characters.
            </p>
          </div>

          <div style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.06)", margin: "0 2rem" }} />

          <div className="px-8 py-7">
            {!record ? (
              <div className="flex flex-col items-center gap-4 text-center py-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "rgba(211,58,44,0.12)" }}>
                  <XCircle className="h-6 w-6" style={{ color: "#D33A2C" }} />
                </div>
                <div>
                  <p className="font-semibold text-white mb-1">Link expired or invalid</p>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                    This reset link has expired or already been used. Request a new one below.
                  </p>
                </div>
                <Link
                  href="/admin/login/forgot-password"
                  className="mt-2 h-11 px-6 rounded-xl font-semibold text-sm flex items-center"
                  style={{ backgroundColor: "#E15A2C", color: "#fff" }}
                >
                  Request new link
                </Link>
              </div>
            ) : (
              <ResetPasswordForm boundAction={boundAction} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
