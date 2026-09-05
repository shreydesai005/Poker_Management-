"use client";

import { useMemo, useState } from "react";

type Player = {
  id: number;
  name: string;
  rebuys: number;
  cashOut: number;
  active: boolean;
};

type Settlement = {
  from: string;
  to: string;
  amount: number;
};

export default function Home() {
  const [numberOfPlayers, setNumberOfPlayers] = useState(4);
  const [buyIn, setBuyIn] = useState(500);

  const [players, setPlayers] = useState<Player[]>([]);

  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);

  // -----------------------------------
  // CREATE PLAYERS
  // -----------------------------------

  const createPlayers = () => {
    if (numberOfPlayers < 2) {
      alert("You need at least 2 players.");
      return;
    }

    if (buyIn <= 0) {
      alert("Buy-in must be greater than 0.");
      return;
    }

    const newPlayers: Player[] = Array.from(
      { length: numberOfPlayers },
      (_, index) => ({
        id: index + 1,
        name: "",
        rebuys: 0,
        cashOut: 0,
        active: true,
      })
    );

    setPlayers(newPlayers);
    setGameStarted(false);
    setGameFinished(false);
  };

  // -----------------------------------
  // UPDATE PLAYER NAME
  // -----------------------------------

  const updateName = (id: number, name: string) => {
    setPlayers((prev) =>
      prev.map((player) =>
        player.id === id ? { ...player, name } : player
      )
    );
  };

  // -----------------------------------
  // ADD PLAYER MID GAME
  // -----------------------------------

  const addPlayerMidGame = () => {
    if (gameFinished) return;

    const nextId =
      players.length === 0
        ? 1
        : Math.max(...players.map((player) => player.id)) + 1;

    const newPlayer: Player = {
      id: nextId,
      name: `Player ${nextId}`,
      rebuys: 0,
      cashOut: 0,
      active: true,
    };

    setPlayers((prev) => [...prev, newPlayer]);
  };

  // -----------------------------------
  // REBUYS
  // -----------------------------------

  const addRebuy = (id: number) => {
    if (gameFinished) return;

    setPlayers((prev) =>
      prev.map((player) =>
        player.id === id && player.active
          ? {
              ...player,
              rebuys: player.rebuys + 1,
            }
          : player
      )
    );
  };

  const removeRebuy = (id: number) => {
    if (gameFinished) return;

    setPlayers((prev) =>
      prev.map((player) =>
        player.id === id && player.active
          ? {
              ...player,
              rebuys: Math.max(0, player.rebuys - 1),
            }
          : player
      )
    );
  };

  // -----------------------------------
  // CASH OUT
  // -----------------------------------

  const updateCashOut = (id: number, value: number) => {
    if (gameFinished) return;

    setPlayers((prev) =>
      prev.map((player) =>
        player.id === id
          ? {
              ...player,
              cashOut: Math.max(0, value),
            }
          : player
      )
    );
  };

  // -----------------------------------
  // PLAYER LEAVES TABLE
  // -----------------------------------

  const markPlayerLeft = (id: number) => {
    if (gameFinished) return;

    const player = players.find((player) => player.id === id);

    if (!player) return;

    if (player.cashOut <= 0) {
      alert(
        `Enter ${
          player.name || "this player's"
        } cash-out amount before marking them as left.`
      );
      return;
    }

    const confirmLeave = window.confirm(
      `${player.name} is leaving with ₹${player.cashOut.toLocaleString(
        "en-IN"
      )}. Confirm?`
    );

    if (!confirmLeave) return;

    setPlayers((prev) =>
      prev.map((player) =>
        player.id === id
          ? {
              ...player,
              active: false,
            }
          : player
      )
    );
  };

  // -----------------------------------
  // REOPEN PLAYER
  // -----------------------------------

  const reopenPlayer = (id: number) => {
    if (gameFinished) return;

    setPlayers((prev) =>
      prev.map((player) =>
        player.id === id
          ? {
              ...player,
              active: true,
            }
          : player
      )
    );
  };

  // -----------------------------------
  // START GAME
  // -----------------------------------

  const startGame = () => {
    const emptyName = players.some(
      (player) => player.name.trim() === ""
    );

    if (emptyName) {
      alert("Please enter all player names.");
      return;
    }

    setGameStarted(true);
  };

  // -----------------------------------
  // RESET GAME
  // -----------------------------------

  const resetGame = () => {
    setPlayers([]);
    setGameStarted(false);
    setGameFinished(false);
  };

  // -----------------------------------
  // ACTIVE PLAYERS COUNT
  // -----------------------------------

  const activePlayersCount = useMemo(() => {
    return players.filter((player) => player.active).length;
  }, [players]);

  // -----------------------------------
  // TOTAL INVESTED
  // -----------------------------------

  const totalInvested = useMemo(() => {
    return players.reduce((total, player) => {
      const invested = buyIn * (1 + player.rebuys);

      return total + invested;
    }, 0);
  }, [players, buyIn]);

  // -----------------------------------
  // TOTAL CASH OUT
  // -----------------------------------

  const totalCashOut = useMemo(() => {
    return players.reduce(
      (total, player) => total + player.cashOut,
      0
    );
  }, [players]);

  // -----------------------------------
  // RAW BALANCES
  // -----------------------------------

  const rawBalances = useMemo(() => {
    return players.map((player) => {
      const invested = buyIn * (1 + player.rebuys);

      return {
        id: player.id,
        name: player.name,
        rebuys: player.rebuys,
        invested,
        cashOut: player.cashOut,
        rawProfit: player.cashOut - invested,
        active: player.active,
      };
    });
  }, [players, buyIn]);

  // -----------------------------------
  // DIFFERENCE
  // -----------------------------------

  const difference = totalCashOut - totalInvested;

  // -----------------------------------
  // EQUAL ADJUSTMENT
  // -----------------------------------

  const adjustmentPerPlayer = useMemo(() => {
    if (players.length === 0) return 0;

    return -difference / players.length;
  }, [difference, players.length]);

  // -----------------------------------
  // ADJUSTED BALANCES
  // -----------------------------------

  const adjustedBalances = useMemo(() => {
    return rawBalances.map((player) => ({
      ...player,
      adjustment: adjustmentPerPlayer,
      adjustedProfit:
        player.rawProfit + adjustmentPerPlayer,
    }));
  }, [rawBalances, adjustmentPerPlayer]);

  // -----------------------------------
  // FINAL BALANCE
  // -----------------------------------

  const finalBalance = useMemo(() => {
    return adjustedBalances.reduce(
      (total, player) =>
        total + player.adjustedProfit,
      0
    );
  }, [adjustedBalances]);

  // -----------------------------------
  // SETTLEMENT
  // -----------------------------------

  const settlements = useMemo(() => {
    const creditors = adjustedBalances
      .filter((player) => player.adjustedProfit > 0.01)
      .map((player) => ({
        name: player.name,
        balance: player.adjustedProfit,
      }))
      .sort((a, b) => b.balance - a.balance);

    const debtors = adjustedBalances
      .filter((player) => player.adjustedProfit < -0.01)
      .map((player) => ({
        name: player.name,
        balance: Math.abs(player.adjustedProfit),
      }))
      .sort((a, b) => b.balance - a.balance);

    const result: Settlement[] = [];

    let creditorIndex = 0;
    let debtorIndex = 0;

    while (
      creditorIndex < creditors.length &&
      debtorIndex < debtors.length
    ) {
      const creditor = creditors[creditorIndex];
      const debtor = debtors[debtorIndex];

      const amount = Math.min(
        creditor.balance,
        debtor.balance
      );

      if (amount > 0.01) {
        result.push({
          from: debtor.name,
          to: creditor.name,
          amount,
        });
      }

      creditor.balance -= amount;
      debtor.balance -= amount;

      if (creditor.balance < 0.01) {
        creditorIndex++;
      }

      if (debtor.balance < 0.01) {
        debtorIndex++;
      }
    }

    return result;
  }, [adjustedBalances]);

  // -----------------------------------
  // FINISH GAME
  // -----------------------------------

  const finishGame = () => {
    const invalidName = players.some(
      (player) => player.name.trim() === ""
    );

    if (invalidName) {
      alert("Please enter a name for every player.");
      return;
    }

    const activeWithoutCashOut = players.filter(
      (player) =>
        player.active && player.cashOut <= 0
    );

    if (activeWithoutCashOut.length > 0) {
      const names = activeWithoutCashOut
        .map((player) => player.name)
        .join(", ");

      alert(
        `Enter final cash-out amounts for: ${names}`
      );

      return;
    }

    setGameFinished(true);
  };

  // -----------------------------------
  // UI
  // -----------------------------------

  return (
    <main className="min-h-screen bg-[#061a12] text-white">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        {/* HEADER */}

        <header className="mb-10 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
              Poker Night
            </p>

            <h1 className="mt-2 text-4xl font-black md:text-5xl">
              Poker Manager
            </h1>

            <p className="mt-3 text-gray-400">
              Manage players, buy-ins, rebuys,
              cash-outs and settlements.
            </p>
          </div>

          <div className="hidden text-6xl md:block">
            ♠
          </div>
        </header>

        {/* ================================= */}
        {/* GAME SETUP */}
        {/* ================================= */}

        {!gameStarted && (
          <>
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl md:p-8">
              <h2 className="text-2xl font-bold">
                Game Setup
              </h2>

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Number of Players
                  </label>

                  <input
                    type="number"
                    min={2}
                    value={numberOfPlayers}
                    onChange={(e) =>
                      setNumberOfPlayers(
                        Number(e.target.value)
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-4 outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-gray-400">
                    Fixed Buy-In
                  </label>

                  <div className="flex rounded-xl border border-white/10 bg-black/20 focus-within:border-emerald-500">
                    <span className="flex items-center px-4 text-gray-400">
                      ₹
                    </span>

                    <input
                      type="number"
                      min={1}
                      value={buyIn}
                      onChange={(e) =>
                        setBuyIn(
                          Number(e.target.value)
                        )
                      }
                      className="w-full bg-transparent px-2 py-4 outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={createPlayers}
                className="mt-6 rounded-xl bg-emerald-500 px-6 py-4 font-bold text-black transition hover:bg-emerald-400"
              >
                Create Players
              </button>
            </section>

            {/* PLAYER NAMES */}

            {players.length > 0 && (
              <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <h2 className="text-2xl font-bold">
                      Enter Players
                    </h2>

                    <p className="mt-1 text-gray-400">
                      Every player starts with one
                      fixed buy-in.
                    </p>
                  </div>

                  <div className="rounded-xl bg-emerald-500/10 px-5 py-3">
                    <p className="text-xs uppercase tracking-wider text-gray-400">
                      Starting Pot
                    </p>

                    <p className="text-2xl font-bold text-emerald-400">
                      ₹
                      {(
                        players.length * buyIn
                      ).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">
                        Player {player.id}
                      </p>

                      <input
                        type="text"
                        value={player.name}
                        placeholder={`Player ${player.id} name`}
                        onChange={(e) =>
                          updateName(
                            player.id,
                            e.target.value
                          )
                        }
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-emerald-500"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={startGame}
                  className="mt-7 w-full rounded-xl bg-emerald-500 px-6 py-4 text-lg font-black text-black transition hover:bg-emerald-400"
                >
                  Start Game ♠
                </button>
              </section>
            )}
          </>
        )}

        {/* ================================= */}
        {/* LIVE GAME */}
        {/* ================================= */}

        {gameStarted && (
          <>
            {/* STATS */}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Stat
                title="Total Players"
                value={players.length.toString()}
              />

              <Stat
                title="Active Players"
                value={activePlayersCount.toString()}
                highlight
              />

              <Stat
                title="Buy-In"
                value={`₹${buyIn.toLocaleString(
                  "en-IN"
                )}`}
              />

              <Stat
                title="Total Invested"
                value={`₹${totalInvested.toLocaleString(
                  "en-IN"
                )}`}
                highlight
              />

              <Stat
                title="Cash Out"
                value={`₹${totalCashOut.toLocaleString(
                  "en-IN"
                )}`}
              />
            </section>

            {/* LIVE TABLE */}

            <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                    Live Table
                  </p>

                  <h2 className="mt-1 text-3xl font-black">
                    Players
                  </h2>
                </div>

                {!gameFinished && (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={addPlayerMidGame}
                      className="rounded-xl bg-emerald-500 px-4 py-2 font-bold text-black transition hover:bg-emerald-400"
                    >
                      + Add Player
                    </button>

                    <span className="rounded-full bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400">
                      ● LIVE
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {players.map((player) => {
                  const invested =
                    buyIn *
                    (1 + player.rebuys);

                  const rawProfit =
                    player.cashOut - invested;

                  return (
                    <div
                      key={player.id}
                      className={`rounded-2xl border p-5 ${
                        player.active
                          ? "border-white/10 bg-black/20"
                          : "border-yellow-500/20 bg-yellow-500/5"
                      }`}
                    >
                      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
                        {/* PLAYER INFO */}

                        <div className="flex min-w-[260px] items-center gap-4">
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-black ${
                              player.active
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-yellow-500/10 text-yellow-400"
                            }`}
                          >
                            {player.id}
                          </div>

                          <div className="w-full">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                disabled={
                                  gameFinished
                                }
                                value={player.name}
                                onChange={(e) =>
                                  updateName(
                                    player.id,
                                    e.target.value
                                  )
                                }
                                className="w-full max-w-[220px] rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-bold outline-none focus:border-emerald-500 disabled:border-transparent disabled:bg-transparent disabled:px-0"
                              />

                              {player.active ? (
                                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                                  ACTIVE
                                </span>
                              ) : (
                                <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-400">
                                  LEFT TABLE
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-sm text-gray-500">
                              Invested ₹
                              {invested.toLocaleString(
                                "en-IN"
                              )}
                            </p>

                            {!player.active && (
                              <p className="mt-1 text-sm font-semibold text-yellow-400">
                                Cashed out ₹
                                {player.cashOut.toLocaleString(
                                  "en-IN"
                                )}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid flex-1 gap-5 sm:grid-cols-4">
                          {/* REBUYS */}

                          <div>
                            <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">
                              Rebuys
                            </p>

                            <div className="flex items-center gap-3">
                              <button
                                onClick={() =>
                                  removeRebuy(
                                    player.id
                                  )
                                }
                                disabled={
                                  gameFinished ||
                                  !player.active
                                }
                                className="h-10 w-10 rounded-lg border border-white/10 bg-white/5 text-xl disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                −
                              </button>

                              <span className="min-w-8 text-center text-lg font-bold">
                                {player.rebuys}
                              </span>

                              <button
                                onClick={() =>
                                  addRebuy(
                                    player.id
                                  )
                                }
                                disabled={
                                  gameFinished ||
                                  !player.active
                                }
                                className="h-10 w-10 rounded-lg bg-emerald-500 font-black text-black disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* CASH OUT */}

                          <div>
                            <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">
                              Cash Out
                            </p>

                            <div className="flex rounded-xl border border-white/10 bg-white/5">
                              <span className="flex items-center px-3 text-gray-500">
                                ₹
                              </span>

                              <input
                                type="number"
                                min={0}
                                disabled={
                                  gameFinished ||
                                  !player.active
                                }
                                value={
                                  player.cashOut
                                }
                                onChange={(e) =>
                                  updateCashOut(
                                    player.id,
                                    Number(
                                      e.target
                                        .value
                                    )
                                  )
                                }
                                className="w-full bg-transparent px-2 py-3 outline-none disabled:opacity-50"
                              />
                            </div>
                          </div>

                          {/* CURRENT P/L */}

                          <div>
                            <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">
                              Current P/L
                            </p>

                            <p
                              className={`text-xl font-black ${
                                rawProfit > 0
                                  ? "text-emerald-400"
                                  : rawProfit <
                                    0
                                  ? "text-red-400"
                                  : "text-gray-400"
                              }`}
                            >
                              {rawProfit > 0
                                ? "+"
                                : ""}
                              ₹
                              {rawProfit.toLocaleString(
                                "en-IN"
                              )}
                            </p>
                          </div>

                          {/* ACTION */}

                          <div>
                            <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">
                              Status
                            </p>

                            {player.active ? (
                              <button
                                onClick={() =>
                                  markPlayerLeft(
                                    player.id
                                  )
                                }
                                disabled={
                                  gameFinished
                                }
                                className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-bold text-yellow-400 transition hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                Player Left
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  reopenPlayer(
                                    player.id
                                  )
                                }
                                disabled={
                                  gameFinished
                                }
                                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-400 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                Reopen Player
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!gameFinished ? (
                <button
                  onClick={finishGame}
                  className="mt-8 w-full rounded-xl bg-emerald-500 px-6 py-4 text-lg font-black text-black transition hover:bg-emerald-400"
                >
                  Finish Game & Calculate
                  Settlement
                </button>
              ) : (
                <button
                  onClick={() =>
                    setGameFinished(false)
                  }
                  className="mt-8 w-full rounded-xl border border-white/10 bg-white/5 px-6 py-4 font-bold transition hover:bg-white/10"
                >
                  Edit Game
                </button>
              )}
            </section>

            {/* ================================= */}
            {/* FINAL SETTLEMENT */}
            {/* ================================= */}

            {gameFinished && (
              <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                      Game Complete
                    </p>

                    <h2 className="mt-1 text-3xl font-black">
                      Final Settlement
                    </h2>

                    <p className="mt-2 text-gray-400">
                      Players who left earlier
                      remain part of the final
                      accounting.
                    </p>
                  </div>

                  <div className="rounded-xl bg-emerald-500/10 px-5 py-3 text-emerald-400">
                    ✓ Balanced
                  </div>
                </div>

                {/* ADJUSTMENT */}

                {Math.abs(difference) >
                  0.01 && (
                  <div className="mt-6 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6">
                    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                      <div>
                        <p className="text-lg font-black text-yellow-300">
                          Equal Adjustment
                          Applied
                        </p>

                        <p className="mt-2 text-sm text-gray-300">
                          {difference < 0
                            ? "The recorded cash is lower than the total invested amount, so the missing amount is added equally to every player."
                            : "The recorded cash is higher than the total invested amount, so the extra amount is subtracted equally from every player."}
                        </p>
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-xs uppercase tracking-wider text-gray-500">
                          Adjustment Per
                          Player
                        </p>

                        <p
                          className={`mt-1 text-3xl font-black ${
                            adjustmentPerPlayer >
                            0
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          {adjustmentPerPlayer >
                          0
                            ? "+"
                            : ""}
                          ₹
                          {adjustmentPerPlayer.toLocaleString(
                            "en-IN",
                            {
                              maximumFractionDigits: 2,
                            }
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-3">
                      <MiniStat
                        title="Total Invested"
                        value={`₹${totalInvested.toLocaleString(
                          "en-IN"
                        )}`}
                      />

                      <MiniStat
                        title="Total Cash Out"
                        value={`₹${totalCashOut.toLocaleString(
                          "en-IN"
                        )}`}
                      />

                      <MiniStat
                        title="Difference"
                        value={`₹${Math.abs(
                          difference
                        ).toLocaleString(
                          "en-IN"
                        )}`}
                      />
                    </div>
                  </div>
                )}

                {/* WHO PAYS WHOM */}

                <div className="mt-8">
                  <h3 className="text-xl font-bold">
                    Who Pays Whom
                  </h3>

                  {settlements.length ===
                  0 ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-6 text-gray-400">
                      No transfers required.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {settlements.map(
                        (
                          settlement,
                          index
                        ) => (
                          <div
                            key={index}
                            className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-5 sm:flex-row sm:items-center"
                          >
                            <div className="flex items-center gap-3 text-lg">
                              <span className="font-bold text-red-400">
                                {
                                  settlement.from
                                }
                              </span>

                              <span className="text-gray-600">
                                →
                              </span>

                              <span className="font-bold text-emerald-400">
                                {
                                  settlement.to
                                }
                              </span>
                            </div>

                            <p className="text-2xl font-black">
                              ₹
                              {settlement.amount.toLocaleString(
                                "en-IN",
                                {
                                  maximumFractionDigits: 2,
                                }
                              )}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>

                {/* PLAYER RESULTS */}

                <div className="mt-10">
                  <h3 className="mb-4 text-xl font-bold">
                    Player Results
                  </h3>

                  <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <div className="min-w-[950px]">
                      <div className="grid grid-cols-8 bg-white/5 px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-500">
                        <span>Player</span>
                        <span>Status</span>
                        <span>Rebuys</span>
                        <span>Invested</span>
                        <span>Cash Out</span>
                        <span>
                          Original P/L
                        </span>
                        <span>
                          Adjustment
                        </span>
                        <span>Final P/L</span>
                      </div>

                      {adjustedBalances.map(
                        (player) => (
                          <div
                            key={player.id}
                            className="grid grid-cols-8 border-t border-white/10 px-5 py-4 text-sm"
                          >
                            <span className="font-semibold">
                              {player.name}
                            </span>

                            <span
                              className={
                                player.active
                                  ? "font-semibold text-emerald-400"
                                  : "font-semibold text-yellow-400"
                              }
                            >
                              {player.active
                                ? "Active"
                                : "Left"}
                            </span>

                            <span>
                              {player.rebuys}
                            </span>

                            <span>
                              ₹
                              {player.invested.toLocaleString(
                                "en-IN"
                              )}
                            </span>

                            <span>
                              ₹
                              {player.cashOut.toLocaleString(
                                "en-IN"
                              )}
                            </span>

                            <span
                              className={
                                player.rawProfit >
                                0
                                  ? "font-bold text-emerald-400"
                                  : player.rawProfit <
                                    0
                                  ? "font-bold text-red-400"
                                  : ""
                              }
                            >
                              {player.rawProfit >
                              0
                                ? "+"
                                : ""}
                              ₹
                              {player.rawProfit.toLocaleString(
                                "en-IN",
                                {
                                  maximumFractionDigits: 2,
                                }
                              )}
                            </span>

                            <span
                              className={
                                player.adjustment >
                                0
                                  ? "font-bold text-emerald-400"
                                  : player.adjustment <
                                    0
                                  ? "font-bold text-red-400"
                                  : ""
                              }
                            >
                              {player.adjustment >
                              0
                                ? "+"
                                : ""}
                              ₹
                              {player.adjustment.toLocaleString(
                                "en-IN",
                                {
                                  maximumFractionDigits: 2,
                                }
                              )}
                            </span>

                            <span
                              className={
                                player.adjustedProfit >
                                0
                                  ? "font-black text-emerald-400"
                                  : player.adjustedProfit <
                                    0
                                  ? "font-black text-red-400"
                                  : "font-black text-gray-400"
                              }
                            >
                              {player.adjustedProfit >
                              0
                                ? "+"
                                : ""}
                              ₹
                              {player.adjustedProfit.toLocaleString(
                                "en-IN",
                                {
                                  maximumFractionDigits: 2,
                                }
                              )}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* FINAL CHECK */}

                <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
                    Final Check
                  </p>

                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-sm text-gray-400">
                        Original Difference
                      </p>

                      <p
                        className={`mt-1 text-xl font-bold ${
                          difference > 0
                            ? "text-emerald-400"
                            : difference < 0
                            ? "text-red-400"
                            : ""
                        }`}
                      >
                        {difference > 0
                          ? "+"
                          : ""}
                        ₹
                        {difference.toLocaleString(
                          "en-IN",
                          {
                            maximumFractionDigits: 2,
                          }
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-400">
                        Per Player Adjustment
                      </p>

                      <p className="mt-1 text-xl font-bold">
                        {adjustmentPerPlayer >
                        0
                          ? "+"
                          : ""}
                        ₹
                        {adjustmentPerPlayer.toLocaleString(
                          "en-IN",
                          {
                            maximumFractionDigits: 2,
                          }
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-gray-400">
                        Final Balance
                      </p>

                      <p className="mt-1 text-xl font-black text-emerald-400">
                        ₹
                        {Math.abs(
                          finalBalance
                        ) < 0.01
                          ? "0"
                          : finalBalance.toLocaleString(
                              "en-IN",
                              {
                                maximumFractionDigits: 2,
                              }
                            )}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* NEW GAME */}

            <button
              onClick={resetGame}
              className="mt-8 w-full rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-4 font-bold text-red-400 transition hover:bg-red-500/20"
            >
              Start New Game
            </button>
          </>
        )}
      </div>
    </main>
  );
}

// -----------------------------------
// STAT COMPONENT
// -----------------------------------

function Stat({
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

// -----------------------------------
// MINI STAT COMPONENT
// -----------------------------------

function MiniStat({
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

      <p className="mt-1 text-lg font-bold">
        {value}
      </p>
    </div>
  );
}