"use client";

import { useEffect, useMemo, useState } from "react";
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

type PlayerRow = {
  id: string;
  game_id: string;
  name: string;
  rebuys: number;
  cash_out: number;
  active: boolean;
};

type PlayerGameResult = {
  gameId: string;
  playerName: string;
  invested: number;
  cashOut: number;
  rawProfit: number;
  adjustment: number;
  finalProfit: number;
};

type PlayerStats = {
  key: string;
  name: string;
  totalGames: number;
  wins: number;
  losses: number;
  breakEven: number;

  totalInvested: number;
  totalCashOut: number;

  totalProfit: number;
  averageProfit: number;

  biggestWin: number;
  biggestLoss: number;

  winRate: number;
};

export default function AnalyticsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [results, setResults] = useState<
    PlayerGameResult[]
  >([]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    // --------------------------------
    // LOAD FINISHED GAMES
    // --------------------------------

    const {
      data: gameData,
      error: gameError,
    } = await supabase
      .from("games")
      .select(
        "id, buy_in, status, created_at, finished_at"
      )
      .eq("user_id", user.id)
      .eq("status", "finished");

    if (gameError) {
      console.error(
        "Analytics game error:",
        gameError
      );

      setLoading(false);
      return;
    }

    const games = (gameData || []) as Game[];

    if (games.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    // --------------------------------
    // LOAD PLAYERS
    // --------------------------------

    const gameIds = games.map(
      (game) => game.id
    );

    const {
      data: playerData,
      error: playerError,
    } = await supabase
      .from("players")
      .select(
        "id, game_id, name, rebuys, cash_out, active"
      )
      .in("game_id", gameIds);

    if (playerError) {
      console.error(
        "Analytics player error:",
        playerError
      );

      setLoading(false);
      return;
    }

    const players =
      (playerData || []) as PlayerRow[];

    // --------------------------------
    // CALCULATE EVERY GAME
    // --------------------------------

    const allResults: PlayerGameResult[] =
      [];

    for (const game of games) {
      const gamePlayers = players.filter(
        (player) =>
          player.game_id === game.id
      );

      if (gamePlayers.length === 0) {
        continue;
      }

      const buyIn = Number(
        game.buy_in
      );

      const calculatedPlayers =
        gamePlayers.map((player) => {
          const rebuys = Number(
            player.rebuys || 0
          );

          const cashOut = Number(
            player.cash_out || 0
          );

          const invested =
            buyIn * (1 + rebuys);

          const rawProfit =
            cashOut - invested;

          return {
            player,
            invested,
            cashOut,
            rawProfit,
          };
        });

      const totalInvested =
        calculatedPlayers.reduce(
          (total, item) =>
            total + item.invested,
          0
        );

      const totalCashOut =
        calculatedPlayers.reduce(
          (total, item) =>
            total + item.cashOut,
          0
        );

      // --------------------------------
      // SAME RULE AS MAIN GAME PAGE
      // --------------------------------

      const difference =
        totalCashOut -
        totalInvested;

      const adjustmentPerPlayer =
        -difference /
        calculatedPlayers.length;

      for (const item of calculatedPlayers) {
        allResults.push({
          gameId: game.id,

          playerName:
            item.player.name.trim(),

          invested:
            item.invested,

          cashOut:
            item.cashOut,

          rawProfit:
            item.rawProfit,

          adjustment:
            adjustmentPerPlayer,

          finalProfit:
            item.rawProfit +
            adjustmentPerPlayer,
        });
      }
    }

    setResults(allResults);

    setLoading(false);
  };

  // ==================================
  // BUILD PLAYER STATS
  // ==================================

  const playerStats =
    useMemo(() => {
      const map = new Map<
        string,
        {
          name: string;
          games: PlayerGameResult[];
        }
      >();

      for (const result of results) {
        const key =
          result.playerName
            .trim()
            .toLowerCase();

        if (!key) continue;

        const existing =
          map.get(key);

        if (existing) {
          existing.games.push(
            result
          );
        } else {
          map.set(key, {
            name:
              result.playerName,
            games: [result],
          });
        }
      }

      const stats: PlayerStats[] =
        [];

      for (const [
        key,
        value,
      ] of map) {
        const games =
          value.games;

        const totalGames =
          games.length;

        const wins =
          games.filter(
            (game) =>
              game.finalProfit >
              0.01
          ).length;

        const losses =
          games.filter(
            (game) =>
              game.finalProfit <
              -0.01
          ).length;

        const breakEven =
          totalGames -
          wins -
          losses;

        const totalInvested =
          games.reduce(
            (total, game) =>
              total +
              game.invested,
            0
          );

        const totalCashOut =
          games.reduce(
            (total, game) =>
              total +
              game.cashOut,
            0
          );

        const totalProfit =
          games.reduce(
            (total, game) =>
              total +
              game.finalProfit,
            0
          );

        const averageProfit =
          totalGames === 0
            ? 0
            : totalProfit /
              totalGames;

        const profitValues =
          games.map(
            (game) =>
              game.finalProfit
          );

        const biggestWin =
          Math.max(
            0,
            ...profitValues
          );

        const biggestLoss =
          Math.min(
            0,
            ...profitValues
          );

        const winRate =
          totalGames === 0
            ? 0
            : (wins /
                totalGames) *
              100;

        stats.push({
          key,

          name:
            value.name,

          totalGames,

          wins,

          losses,

          breakEven,

          totalInvested,

          totalCashOut,

          totalProfit,

          averageProfit,

          biggestWin,

          biggestLoss,

          winRate,
        });
      }

      return stats.sort(
        (a, b) =>
          b.totalProfit -
          a.totalProfit
      );
    }, [results]);

  // ==================================
  // OVERALL SUMMARY
  // ==================================

  const totalPlayers =
    playerStats.length;

  const totalGames =
    new Set(
      results.map(
        (result) =>
          result.gameId
      )
    ).size;

  const totalMoneyPlayed =
    results.reduce(
      (total, result) =>
        total +
        result.invested,
      0
    );

  const mostProfitablePlayer =
    playerStats.length > 0
      ? playerStats[0]
      : null;

  // ==================================
  // LOADING
  // ==================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#061a12] text-white">
        <p className="text-gray-400">
          Loading analytics...
        </p>
      </main>
    );
  }

  // ==================================
  // UI
  // ==================================

  return (
    <main className="min-h-screen bg-[#061a12] text-white">
      <div className="mx-auto max-w-7xl px-5 py-8">
        {/* HEADER */}

        <header className="flex flex-col gap-5 border-b border-white/10 pb-7 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
              ♠ Poker Manager
            </p>

            <h1 className="mt-2 text-4xl font-black">
              Player Analytics
            </h1>

            <p className="mt-2 text-gray-400">
              Lifetime performance across
              completed poker games.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/history"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center font-semibold hover:bg-white/10"
            >
              History
            </Link>

            <Link
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center font-semibold hover:bg-white/10"
            >
              Dashboard
            </Link>
          </div>
        </header>

        {/* EMPTY */}

        {playerStats.length === 0 ? (
          <section className="mt-10 rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
            <div className="text-6xl">
              ♠
            </div>

            <h2 className="mt-5 text-2xl font-black">
              No analytics yet
            </h2>

            <p className="mt-2 text-gray-400">
              Finish some poker games and
              player statistics will
              appear here.
            </p>

            <Link
              href="/"
              className="mt-6 inline-block rounded-xl bg-emerald-500 px-6 py-3 font-bold text-black hover:bg-emerald-400"
            >
              Start Game
            </Link>
          </section>
        ) : (
          <>
            {/* SUMMARY */}

            <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="Players"
                value={totalPlayers.toString()}
              />

              <SummaryCard
                title="Games Played"
                value={totalGames.toString()}
              />

              <SummaryCard
                title="Money Played"
                value={`₹${totalMoneyPlayed.toLocaleString(
                  "en-IN",
                  {
                    maximumFractionDigits: 2,
                  }
                )}`}
              />

              <SummaryCard
                title="Top Player"
                value={
                  mostProfitablePlayer?.name ||
                  "-"
                }
                highlight
              />
            </section>

            {/* LEADERBOARD */}

            <section className="mt-10">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                  Rankings
                </p>

                <h2 className="mt-1 text-3xl font-black">
                  Leaderboard
                </h2>
              </div>

              <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                <div className="overflow-x-auto">
                  <div className="min-w-[1000px]">
                    {/* TABLE HEADER */}

                    <div className="grid grid-cols-9 bg-black/20 px-6 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                      <span>
                        Rank
                      </span>

                      <span>
                        Player
                      </span>

                      <span>
                        Games
                      </span>

                      <span>
                        W / L
                      </span>

                      <span>
                        Win Rate
                      </span>

                      <span>
                        Invested
                      </span>

                      <span>
                        Avg P/L
                      </span>

                      <span>
                        Biggest Win
                      </span>

                      <span>
                        Total P/L
                      </span>
                    </div>

                    {/* PLAYERS */}

                    {playerStats.map(
                      (
                        player,
                        index
                      ) => (
                        <div
                          key={
                            player.key
                          }
                          className="grid grid-cols-9 items-center border-t border-white/10 px-6 py-5 text-sm"
                        >
                          <span className="text-lg font-black">
                            {index === 0
                              ? "🥇"
                              : index === 1
                              ? "🥈"
                              : index === 2
                              ? "🥉"
                              : `#${index + 1}`}
                          </span>

                          <span className="font-bold">
                            {
                              player.name
                            }
                          </span>

                          <span>
                            {
                              player.totalGames
                            }
                          </span>

                          <span>
                            <span className="text-emerald-400">
                              {
                                player.wins
                              }
                            </span>

                            <span className="text-gray-600">
                              {" "}
                              /{" "}
                            </span>

                            <span className="text-red-400">
                              {
                                player.losses
                              }
                            </span>
                          </span>

                          <span>
                            {player.winRate.toFixed(
                              1
                            )}
                            %
                          </span>

                          <span>
                            ₹
                            {player.totalInvested.toLocaleString(
                              "en-IN"
                            )}
                          </span>

                          <ProfitValue
                            value={
                              player.averageProfit
                            }
                          />

                          <ProfitValue
                            value={
                              player.biggestWin
                            }
                          />

                          <ProfitValue
                            value={
                              player.totalProfit
                            }
                            large
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* PLAYER CARDS */}

            <section className="mt-12">
              <h2 className="text-3xl font-black">
                Player Breakdown
              </h2>

              <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {playerStats.map(
                  (
                    player,
                    index
                  ) => (
                    <PlayerCard
                      key={
                        player.key
                      }
                      player={
                        player
                      }
                      rank={
                        index + 1
                      }
                    />
                  )
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

// ==================================
// SUMMARY CARD
// ==================================

function SummaryCard({
  title,
  value,
  highlight = false,
}: {
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p
        className={`mt-2 text-2xl font-black ${
          highlight
            ? "text-emerald-400"
            : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ==================================
// PLAYER CARD
// ==================================

function PlayerCard({
  player,
  rank,
}: {
  player: PlayerStats;
  rank: number;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
            Rank #{rank}
          </p>

          <h3 className="mt-2 text-2xl font-black">
            {player.name}
          </h3>
        </div>

        <div className="text-3xl">
          {rank === 1
            ? "🥇"
            : rank === 2
            ? "🥈"
            : rank === 3
            ? "🥉"
            : "♠"}
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-black/20 p-5">
        <p className="text-xs uppercase tracking-wider text-gray-500">
          Lifetime P/L
        </p>

        <ProfitValue
          value={
            player.totalProfit
          }
          large
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniCard
          title="Games"
          value={
            player.totalGames.toString()
          }
        />

        <MiniCard
          title="Win Rate"
          value={`${player.winRate.toFixed(
            1
          )}%`}
        />

        <MiniCard
          title="Wins"
          value={
            player.wins.toString()
          }
        />

        <MiniCard
          title="Losses"
          value={
            player.losses.toString()
          }
        />

        <MiniCard
          title="Invested"
          value={`₹${player.totalInvested.toLocaleString(
            "en-IN"
          )}`}
        />

        <MiniCard
          title="Cash Out"
          value={`₹${player.totalCashOut.toLocaleString(
            "en-IN"
          )}`}
        />

        <MiniCard
          title="Biggest Win"
          value={`+₹${player.biggestWin.toLocaleString(
            "en-IN",
            {
              maximumFractionDigits: 2,
            }
          )}`}
        />

        <MiniCard
          title="Biggest Loss"
          value={`₹${player.biggestLoss.toLocaleString(
            "en-IN",
            {
              maximumFractionDigits: 2,
            }
          )}`}
        />
      </div>
    </div>
  );
}

// ==================================
// MINI CARD
// ==================================

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

// ==================================
// PROFIT VALUE
// ==================================

function ProfitValue({
  value,
  large = false,
}: {
  value: number;
  large?: boolean;
}) {
  return (
    <span
      className={`font-black ${
        large
          ? "text-xl"
          : ""
      } ${
        value > 0.01
          ? "text-emerald-400"
          : value < -0.01
          ? "text-red-400"
          : "text-gray-400"
      }`}
    >
      {value > 0.01 ? "+" : ""}
      ₹
      {value.toLocaleString(
        "en-IN",
        {
          maximumFractionDigits: 2,
        }
      )}
    </span>
  );
}