"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Game = {
  id: string;
  buy_in: number;
  status: string;           
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setEmail(user.email || "");

    const { data, error } = await supabase
      .from("games")
      .select("id, buy_in, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("Dashboard error:", error);
      setLoading(false);
      return;
    }

    setGames(data || []);
    setLoading(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const activeGames = games.filter(
    (game) => game.status === "active"
  );

  const finishedGames = games.filter(
    (game) => game.status === "finished"
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#061a12] text-white">
        <p className="text-gray-400">
          Loading dashboard...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#061a12] text-white">
      <div className="mx-auto max-w-7xl px-5 py-8">
        {/* HEADER */}

        <div className="flex flex-col gap-5 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
              ♠ Poker Manager
            </p>

            <h1 className="mt-2 text-4xl font-black">
              Dashboard
            </h1>

            <p className="mt-2 text-sm text-gray-400">
              {email}
            </p>
          </div>

          <button
            onClick={logout}
            className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-3 font-semibold text-red-400 hover:bg-red-500/20"
          >
            Logout
          </button>
        </div>

        {/* SUMMARY */}

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Total Games"
            value={games.length}
          />

          <StatCard
            title="Active Games"
            value={activeGames.length}
          />

          <StatCard
            title="Finished Games"
            value={finishedGames.length}
          />
        </section>

        {/* NEW GAME */}

        <section className="mt-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
                New Session
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Start a Poker Game
              </h2>

              <p className="mt-2 text-gray-400">
                Set the buy-in, add players and start tracking the game.
              </p>
            </div>

            <Link
  href="/"
  className="rounded-xl bg-emerald-500 px-7 py-4 text-center font-bold text-black hover:bg-emerald-400"
>
  + New Game
</Link>
          </div>
        </section>

        {/* ACTIVE GAMES */}

        <section className="mt-10">
          <h2 className="text-2xl font-black">
            Active Games
          </h2>

          {activeGames.length === 0 ? (
            <EmptyState text="No active games." />
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                />
              ))}
            </div>
          )}
        </section>

        {/* FINISHED GAMES */}

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black">
              Recent Games
            </h2>

            <Link
              href="/history"
              className="text-sm font-semibold text-emerald-400 hover:text-emerald-300"
            >
              View History
            </Link>
            <Link
  href="/analytics"
  className="text-sm font-semibold text-emerald-400 hover:text-emerald-300"
>
  Analytics
</Link>
          </div>

          {finishedGames.length === 0 ? (
            <EmptyState text="No completed games yet." />
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {finishedGames
                .slice(0, 6)
                .map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                  />
                ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-3xl font-black">
        {value}
      </p>
    </div>
  );
}

function GameCard({
  game,
}: {
  game: Game;
}) {
  const date = new Date(
    game.created_at
  ).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const active =
    game.status === "active";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
            {date}
          </p>

          <h3 className="mt-2 text-xl font-black">
            ₹
            {Number(
              game.buy_in
            ).toLocaleString("en-IN")}{" "}
            Buy-In
          </h3>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            active
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-white/5 text-gray-400"
          }`}
        >
          {active ? "ACTIVE" : "FINISHED"}
        </span>
      </div>

      <Link
        href={`/?id=${game.id}`}
        className="mt-6 block rounded-xl bg-emerald-500 px-4 py-3 text-center font-bold text-black hover:bg-emerald-400"
      >
        {active ? "Resume Game" : "View Results"}
      </Link>
    </div>
  );
}

function EmptyState({
  text,
}: {
  text: string;
}) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-gray-500">
      {text}
    </div>
  );
}