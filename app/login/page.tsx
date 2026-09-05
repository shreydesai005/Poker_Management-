"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password) {
      setErrorMessage("Enter email and password.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#061a12] px-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
            ♠ Poker Night
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Welcome Back
          </h1>

          <p className="mt-2 text-gray-400">
            Login to manage your poker games.
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="mt-8 space-y-5"
        >
          <div>
            <label className="mb-2 block text-sm text-gray-400">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-4 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-400">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-4 outline-none focus:border-emerald-500"
            />
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-500 px-6 py-4 font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-bold text-emerald-400"
          >
            Sign Up
          </Link>
        </p>
      </div>
    </main>
  );
}