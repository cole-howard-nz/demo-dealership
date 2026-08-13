"use client";

import { useState, useEffect, useActionState } from "react";
import { Eye, EyeOff, AlertCircle, Lock } from "lucide-react";
import { signInAction } from "./actions";

// ─── Rate limiting (client-side display only — server enforces real limits) ───

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const STORAGE_KEY = "nbm_login_attempts";

interface AttemptRecord {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

function getAttempts(): AttemptRecord {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { count: 0, firstAttemptAt: Date.now(), lockedUntil: null };
}

function saveAttempts(record: AttemptRecord) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {}
}

function clearAttempts() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// ─── Component ────────────────────────────────────────────────────────────────

const initialState = { error: null as string | null };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  const [lockoutMinutes, setLockoutMinutes] = useState<number | null>(() => {
    if (typeof window !== "undefined") {
      const record = getAttempts();
      if (record.lockedUntil && record.lockedUntil > Date.now()) {
        return Math.ceil((record.lockedUntil - Date.now()) / 60000); 
      }
    }
    return null;
  });

  useEffect(() => {
    if (state?.error) {
      const record = getAttempts();
      const newCount = (record?.count || 0) + 1;
      const now = Date.now();
      const lockedUntil = newCount >= MAX_ATTEMPTS ? now + LOCKOUT_MINUTES * 60 * 1000 : null;
      saveAttempts({ ...record, count: newCount, lockedUntil });
      
      if (lockedUntil) {
        requestAnimationFrame(() => {
          setLockoutMinutes(LOCKOUT_MINUTES);
        });
      }
    }
  }, [state?.error]);

  useEffect(() => {
    if (lockoutMinutes === null) return;
    const record = getAttempts();
    if (!record.lockedUntil) return;
    const tick = () => {
      const remaining = record.lockedUntil! - Date.now();
      if (remaining <= 0) { clearAttempts(); setLockoutMinutes(null); setLockoutSeconds(0); return; }
      setLockoutMinutes(Math.ceil(remaining / 60000));
      setLockoutSeconds(Math.ceil((remaining % 60000) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockoutMinutes]);

  const isLocked = lockoutMinutes !== null && lockoutMinutes > 0;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: "#0d1a2b" }}
    >
      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Glow behind card */}
      <div
        className="absolute w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ backgroundColor: "#E15A2C" }}
      />

      {/* Card */}
      <div className="relative w-full max-w-md mx-4">
        {/* Main card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: "#111f30",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 32px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          {/* Card header */}
          <div className="px-8 pt-8 pb-6">
            <h1 className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-sora, sans-serif)", letterSpacing: "-0.02em" }}>
              Sign in
            </h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              Staff portal
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.06)", margin: "0 2rem" }} />

          {/* Form */}
          <div className="px-8 py-7">
            {/* Lockout alert */}
            {isLocked && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-xl p-4 text-sm"
                style={{ backgroundColor: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)", color: "#fca5a5" }}
              >
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Too many attempts. Try again in{" "}
                  <strong className="text-white">{lockoutMinutes}:{String(lockoutSeconds).padStart(2, "0")}</strong>.
                </span>
              </div>
            )}

            {/* Error alert */}
            {state?.error && !isLocked && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-3 rounded-xl p-4 text-sm"
                style={{ backgroundColor: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)", color: "#fca5a5" }}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Incorrect email or password.</span>
              </div>
            )}

            <form action={formAction} className="flex flex-col gap-4" noValidate>
              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={isLocked || isPending}
                  placeholder="you@promptly.nz"
                  className="h-11 rounded-xl px-4 text-sm text-white placeholder:text-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "rgba(225,90,44,0.6)"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)"; }}
                />
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Password
                  </label>
                  <a
                    href="/admin/login/forgot-password"
                    className="text-xs transition-colors hover:text-white"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                  >
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    disabled={isLocked || isPending}
                    className="h-11 w-full rounded-xl px-4 pr-11 text-sm text-white placeholder:text-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = "rgba(225,90,44,0.6)"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)"; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 transition-colors"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLocked || isPending}
                className="mt-2 h-11 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
                style={{ backgroundColor: isLocked ? "#374151" : "#E15A2C" }}
              >
                {isPending ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}