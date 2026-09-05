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
  finished_at: string | null;
};

type Player = {
  id: string;
  game_id: string;
  name: string;
  rebuys: number;
  cash_out: number;
};

type GameSummary = Game & {
  playerCount: number;
  totalInvested: number;
  totalCashOut: number;
};

export default function HistoryPage() {
  const router = useRouter();

  const [games, setGames] = useState<GameSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: gameData, error: gameError } =
      await supabase
        .from("games")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "finished")
        .order("finished_at", {
          ascending: false,
        });

    if (gameError) {
      console.error("History error:", gameError);
      setLoading(false);
      return;
    }

    const finishedGames = gameData || [];

    if (finishedGames.length === 0) {
      setGames([]);
      setLoading(false);
      return;
    }

    const gameIds = finishedGames.map(
      (game) => game.id
    );

    const { data: playerData, error: playerError } =
      await supabase
        .from("players")
        .select(
          "id, game_id, name, rebuys, cash_out"
        )
        .in("game_id", gameIds);

    if (playerError) {
      console.error(
        "Player history error:",
        playerError
      );
      setLoading(false);
      return;
    }

    const players = (playerData || []) as Player[];

    const summaries: GameSummary[] =
      finishedGames.map((game) => {
        const gamePlayers = players.filter(
          (player) =>
            player.game_id === game.id
        );

        const totalInvested =
          gamePlayers.reduce(
            (total, player) =>
              total +
              Number(game.buy_in) *
                (1 +
                  Number(player.rebuys || 0)),
            0
          );

        const totalCashOut =
          gamePlayers.reduce(
            (total, player) =>
              total +
              Number(player.cash_out || 0),
            0
          );

        return {
          ...game,
          playerCount: gamePlayers.length,
          totalInvested,
          totalCashOut,
        };
      });

    setGames(summaries);
    setLoading(false);
  };

  const deleteGame = async (gameId: string) => {
    const confirmed = window.confirm(
      "Delete this game permanently?"
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("games")
      .delete()
      .eq("id", gameId);

    if (error) {
      console.error("Delete error:", error);
      alert("Could not delete game.");
      return;
    }

    setGames((prev) =>
      prev.filter(
        (game) => game.id !== gameId
      )
    );
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#061a12] text-white">
        <p className="text-gray-400">
          Loading history...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#061a12] text-white">
      <div className="mx-auto max-w-7xl px-5 py-8">
        {/* HEADER */}

        <header className="flex flex-col gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
              ♠ Poker Manager
            </p>

            <h1 className="mt-2 text-4xl font-black">
              Game History
            </h1>

            <p className="mt-2 text-gray-400">
              View your completed poker sessions.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center font-semibold hover:bg-white/10"
          >
            Back to Dashboard
          </Link>
        </header>

        {/* SUMMARY */}

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <SummaryCard
            title="Completed Games"
            value={games.length.toString()}
          />

          <SummaryCard
            title="Total Buy-In Money"
            value={`₹${games
              .reduce(
                (total, game) =>
                  total + game.totalInvested,
                0
              )
              .toLocaleString("en-IN")}`}
          />

          <SummaryCard
            title="Total Cash Out"
            value={`₹${games
              .reduce(
                (total, game) =>
                  total + game.totalCashOut,
                0
              )
              .toLocaleString("en-IN")}`}
          />
        </section>

        {/* HISTORY */}

        <section className="mt-10">
          {games.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
              <div className="text-5xl">
                ♠
              </div>

              <h2 className="mt-5 text-2xl font-black">
                No completed games yet
              </h2>

              <p className="mt-2 text-gray-400">
                Finish your first poker game and it
                will appear here.
              </p>

              <Link
                href="/"
                className="mt-6 inline-block rounded-xl bg-emerald-500 px-6 py-3 font-bold text-black hover:bg-emerald-400"
              >
                Start New Game
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {games.map((game) => (
                <GameHistoryCard
                  key={game.id}
                  game={game}
                  onDelete={deleteGame}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function GameHistoryCard({
  game,
  onDelete,
}: {
  game: GameSummary;
  onDelete: (id: string) => void;
}) {
  const date = new Date(
    game.finished_at || game.created_at
  ).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const difference =
    game.totalCashOut -
    game.totalInvested;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
            {date}
          </p>

          <h2 className="mt-2 text-2xl font-black">
            ₹
            {Number(
              game.buy_in
            ).toLocaleString("en-IN")}{" "}
            Buy-In
          </h2>
        </div>

        <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-gray-400">
          FINISHED
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <MiniCard
          title="Players"
          value={game.playerCount.toString()}
        />

        <MiniCard
          title="Invested"
          value={`₹${game.totalInvested.toLocaleString(
            "en-IN"
          )}`}
        />

        <MiniCard
          title="Cash Out"
          value={`₹${game.totalCashOut.toLocaleString(
            "en-IN"
          )}`}
        />

        <MiniCard
          title="Difference"
          value={`${
            difference > 0 ? "+" : ""
          }₹${difference.toLocaleString(
            "en-IN",
            {
              maximumFractionDigits: 2,
            }
          )}`}
        />
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          href={`/?id=${game.id}`}
          className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-center font-bold text-black hover:bg-emerald-400"
        >
          View Results
        </Link>

        <button
          onClick={() =>
            onDelete(game.id)
          }
          className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 font-semibold text-red-400 hover:bg-red-500/20"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-black">
        {value}
      </p>
    </div>
  );
}

function MiniCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-black/20 p-4">
      <p className="text-xs uppercase tracking-wider text-gray-500">
        {title}
      </p>

      <p className="mt-1 font-bold">
        {value}
      </p>
    </div>
  );
}