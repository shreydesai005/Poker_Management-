"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import { supabase } from "@/lib/supabase";

// ======================================================
// MONEY
// ======================================================

const toPaise = (rupees: number) =>
  Math.round(rupees * 100);

const toRupees = (paise: number) =>
  paise / 100;

function formatMoney(value: number) {
  const clean = toRupees(toPaise(value));

  return `₹${clean.toLocaleString("en-IN", {
    minimumFractionDigits:
      Number.isInteger(clean) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

// ======================================================
// TYPES
// ======================================================

type Player = {
  id: number;
  dbId?: string;

  position: number;

  name: string;

  rebuys: number;

  cashOut: number;

  // IMPORTANT:
  // exact text shown in the input
  cashOutText: string;

  cashOutEntered: boolean;

  active: boolean;
};

type PlayerRow = {
  id: string;

  position: number;

  name: string;

  rebuys: number;

  cash_out: number | string;

  cash_out_entered: boolean;

  active: boolean;

  created_at: string;
};

type LoadedGame = {
  id: string;

  user_id: string;

  buy_in: number | string;

  status: string;

  room_code: string | null;
};

type Settlement = {
  from: string;

  to: string;

  amount: number;
};

type SavedSettlement = {
  id: string;

  game_id: string;

  payer_name: string;

  receiver_name: string;

  amount: number;

  status: "pending" | "paid";

  created_at: string;

  paid_at: string | null;
};

type SettlementRow = {
  id: string;

  game_id: string;

  payer_name: string;

  receiver_name: string;

  amount: number | string;

  status: "pending" | "paid";

  created_at: string;

  paid_at: string | null;
};

// ======================================================
// DATABASE CONVERTERS
// ======================================================

function convertPlayerRows(
  rows: PlayerRow[]
): Player[] {
  return [...rows]
    .sort(
      (a, b) =>
        a.position -
        b.position
    )
    .map((player) => {
      const cashOut =
        Number(
          player.cash_out || 0
        );

      return {
        id:
          player.position,

        dbId:
          player.id,

        position:
          player.position,

        name:
          player.name,

        rebuys:
          Number(
            player.rebuys || 0
          ),

        cashOut,

        cashOutText:
          player.cash_out_entered
            ? String(cashOut)
            : "",

        cashOutEntered:
          Boolean(
            player.cash_out_entered
          ),

        active:
          Boolean(
            player.active
          ),
      };
    });
}

function convertSettlementRows(
  rows: SettlementRow[]
): SavedSettlement[] {
  return rows.map(
    (row) => ({
      id:
        row.id,

      game_id:
        row.game_id,

      payer_name:
        row.payer_name,

      receiver_name:
        row.receiver_name,

      amount:
        Number(
          row.amount
        ),

      status:
        row.status,

      created_at:
        row.created_at,

      paid_at:
        row.paid_at,
    })
  );
}

// ======================================================
// MAIN
// ======================================================

function PokerManager() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const [
    numberOfPlayers,
    setNumberOfPlayers,
  ] =
    useState(4);

  const [
    buyIn,
    setBuyIn,
  ] =
    useState(500);

  const [
    players,
    setPlayers,
  ] =
    useState<Player[]>([]);

  const [
    savedSettlements,
    setSavedSettlements,
  ] =
    useState<
      SavedSettlement[]
    >([]);

  const [
    gameStarted,
    setGameStarted,
  ] =
    useState(false);

  const [
    gameFinished,
    setGameFinished,
  ] =
    useState(false);

  const [
    gameId,
    setGameId,
  ] =
    useState<
      string | null
    >(null);

  const [
    hostUserId,
    setHostUserId,
  ] =
    useState<
      string | null
    >(null);

  const [
    currentUserId,
    setCurrentUserId,
  ] =
    useState<
      string | null
    >(null);

  const [
    roomCode,
    setRoomCode,
  ] =
    useState("");

  const [
    joinCode,
    setJoinCode,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    joining,
    setJoining,
  ] =
    useState(false);

  const [
    realtimeConnected,
    setRealtimeConnected,
  ] =
    useState(false);

  // prevents realtime from replacing
  // cashout while user is typing
  const [
    editingCashOutPosition,
    setEditingCashOutPosition,
  ] =
    useState<
      number | null
    >(null);

  // ======================================================
  // HOST / VIEWER
  // ======================================================

  const isHost =
    !!currentUserId &&
    !!hostUserId &&
    currentUserId ===
      hostUserId;

  const isGuest =
    gameStarted &&
    !!currentUserId &&
    !!hostUserId &&
    currentUserId !==
      hostUserId;

  // ======================================================
  // PLAYER ORDER
  // ======================================================

  const orderedPlayers =
    useMemo(() => {
      return [
        ...players,
      ].sort(
        (a, b) =>
          a.position -
          b.position
      );
    }, [players]);

  const activePlayers =
    useMemo(() => {
      return orderedPlayers.filter(
        (player) =>
          player.active
      );
    }, [
      orderedPlayers,
    ]);

  const leftPlayers =
    useMemo(() => {
      return orderedPlayers.filter(
        (player) =>
          !player.active
      );
    }, [
      orderedPlayers,
    ]);

  // ======================================================
  // ROOM CODE
  // ======================================================

  const generateRoomCode =
    () => {
      const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

      let result =
        "";

      for (
        let i = 0;
        i < 6;
        i++
      ) {
        result +=
          characters[
            Math.floor(
              Math.random() *
                characters.length
            )
          ];
      }

      return result;
    };

  // ======================================================
  // OLD GAME ROOM CODE
  // ======================================================

  const createRoomCodeForExistingGame =
    useCallback(
      async (
        existingGameId: string
      ) => {
        for (
          let attempt = 0;
          attempt < 5;
          attempt++
        ) {
          const newCode =
            generateRoomCode();

          const {
            error,
          } =
            await supabase
              .from(
                "games"
              )
              .update({
                room_code:
                  newCode,
              })
              .eq(
                "id",
                existingGameId
              );

          if (!error) {
            setRoomCode(
              newCode
            );

            return;
          }
        }
      },
      []
    );

  // ======================================================
  // LOAD GAME
  // ======================================================

  const loadExistingGame =
    useCallback(
      async (
        existingGameId: string,
        userId?: string
      ) => {
        setLoading(
          true
        );

        const {
          data:
            gameData,

          error:
            gameError,
        } =
          await supabase
            .from(
              "games"
            )
            .select(`
              id,
              user_id,
              buy_in,
              status,
              room_code
            `)
            .eq(
              "id",
              existingGameId
            )
            .single();

        if (
          gameError ||
          !gameData
        ) {
          console.error(
            "GAME LOAD:",
            gameError
          );

          alert(
            "Game could not be found."
          );

          setLoading(
            false
          );

          router.replace(
            "/dashboard"
          );

          return;
        }

        const game =
          gameData as LoadedGame;

        const {
          data:
            playerData,

          error:
            playerError,
        } =
          await supabase
            .from(
              "players"
            )
            .select(`
              id,
              position,
              name,
              rebuys,
              cash_out,
              cash_out_entered,
              active,
              created_at
            `)
            .eq(
              "game_id",
              existingGameId
            )
            .order(
              "position",
              {
                ascending:
                  true,
              }
            );

        if (
          playerError
        ) {
          console.error(
            "PLAYER LOAD:",
            playerError
          );

          alert(
            playerError.message
          );

          setLoading(
            false
          );

          return;
        }

        const {
          data:
            settlementData,

          error:
            settlementError,
        } =
          await supabase
            .from(
              "settlements"
            )
            .select("*")
            .eq(
              "game_id",
              existingGameId
            )
            .order(
              "created_at",
              {
                ascending:
                  true,
              }
            );

        if (
          settlementError
        ) {
          console.error(
            "SETTLEMENT LOAD:",
            settlementError
          );
        }

        const loadedPlayers =
          convertPlayerRows(
            (
              playerData ||
              []
            ) as PlayerRow[]
          );

        const loadedSettlements =
          convertSettlementRows(
            (
              settlementData ||
              []
            ) as SettlementRow[]
          );

        setGameId(
          game.id
        );

        setHostUserId(
          game.user_id
        );

        setBuyIn(
          Number(
            game.buy_in
          )
        );

        setRoomCode(
          game.room_code ||
            ""
        );

        setPlayers(
          loadedPlayers
        );

        setSavedSettlements(
          loadedSettlements
        );

        setNumberOfPlayers(
          loadedPlayers.length
        );

        setGameStarted(
          true
        );

        setGameFinished(
          game.status ===
            "finished"
        );

        if (
          !game.room_code &&
          userId ===
            game.user_id &&
          game.status ===
            "active"
        ) {
          await createRoomCodeForExistingGame(
            game.id
          );
        }

        setLoading(
          false
        );
      },
      [
        router,
        createRoomCodeForExistingGame,
      ]
    );

  // ======================================================
  // AUTH / INITIAL LOAD
  // ======================================================

  useEffect(() => {
    const loadPage =
      async () => {
        setLoading(
          true
        );

        const {
          data: {
            session,
          },

          error:
            sessionError,
        } =
          await supabase.auth.getSession();

        if (
          sessionError
        ) {
          console.error(
            "SESSION ERROR:",
            sessionError
          );

          setLoading(
            false
          );

          router.replace(
            "/login"
          );

          return;
        }

        // NO SESSION IS NORMAL
        if (
          !session
        ) {
          setLoading(
            false
          );

          router.replace(
            "/login"
          );

          return;
        }

        const user =
          session.user;

        setCurrentUserId(
          user.id
        );

        const id =
          searchParams.get(
            "id"
          );

        const room =
          searchParams.get(
            "room"
          );

        if (
          room &&
          !id
        ) {
          setJoinCode(
            room
              .toUpperCase()
              .trim()
          );

          setLoading(
            false
          );

          return;
        }

        if (!id) {
          setLoading(
            false
          );

          return;
        }

        await loadExistingGame(
          id,
          user.id
        );
      };

    loadPage();
  }, [
    router,
    searchParams,
    loadExistingGame,
  ]);

  // ======================================================
  // REALTIME REFRESH
  // ======================================================

  const refreshCurrentGame =
    useCallback(
      async () => {
        if (!gameId) {
          return;
        }

        const {
          data:
            gameData,

          error:
            gameError,
        } =
          await supabase
            .from(
              "games"
            )
            .select(`
              id,
              user_id,
              buy_in,
              status,
              room_code
            `)
            .eq(
              "id",
              gameId
            )
            .single();

        if (
          gameError ||
          !gameData
        ) {
          return;
        }

        const game =
          gameData as LoadedGame;

        const {
          data:
            playerData,

          error:
            playerError,
        } =
          await supabase
            .from(
              "players"
            )
            .select(`
              id,
              position,
              name,
              rebuys,
              cash_out,
              cash_out_entered,
              active,
              created_at
            `)
            .eq(
              "game_id",
              gameId
            )
            .order(
              "position",
              {
                ascending:
                  true,
              }
            );

        if (
          playerError
        ) {
          console.error(
            "REALTIME PLAYER:",
            playerError
          );

          return;
        }

        const {
          data:
            settlementData,
        } =
          await supabase
            .from(
              "settlements"
            )
            .select("*")
            .eq(
              "game_id",
              gameId
            )
            .order(
              "created_at",
              {
                ascending:
                  true,
              }
            );

        const incomingPlayers =
          convertPlayerRows(
            (
              playerData ||
              []
            ) as PlayerRow[]
          );

        // IMPORTANT:
        // while cash-out input is focused,
        // keep the local text/value.
        setPlayers(
          (
            currentPlayers
          ) =>
            incomingPlayers.map(
              (
                incoming
              ) => {
                if (
                  editingCashOutPosition ===
                  incoming.position
                ) {
                  const current =
                    currentPlayers.find(
                      (
                        player
                      ) =>
                        player.position ===
                        incoming.position
                    );

                  if (
                    current
                  ) {
                    return {
                      ...incoming,

                      cashOut:
                        current.cashOut,

                      cashOutText:
                        current.cashOutText,

                      cashOutEntered:
                        current.cashOutEntered,
                    };
                  }
                }

                return incoming;
              }
            )
        );

        setSavedSettlements(
          convertSettlementRows(
            (
              settlementData ||
              []
            ) as SettlementRow[]
          )
        );

        setBuyIn(
          Number(
            game.buy_in
          )
        );

        setRoomCode(
          game.room_code ||
            ""
        );

        setHostUserId(
          game.user_id
        );

        setGameFinished(
          game.status ===
            "finished"
        );

        setGameStarted(
          true
        );
      },
      [
        gameId,
        editingCashOutPosition,
      ]
    );

  // ======================================================
  // REALTIME
  // ======================================================

  useEffect(() => {
    if (!gameId) {
      return;
    }

    const channel =
      supabase
        .channel(
          `poker-game-${gameId}`
        )

        .on(
          "postgres_changes",
          {
            event: "*",

            schema:
              "public",

            table:
              "players",

            filter:
              `game_id=eq.${gameId}`,
          },
          () => {
            refreshCurrentGame();
          }
        )

        .on(
          "postgres_changes",
          {
            event: "*",

            schema:
              "public",

            table:
              "games",

            filter:
              `id=eq.${gameId}`,
          },
          () => {
            refreshCurrentGame();
          }
        )

        .on(
          "postgres_changes",
          {
            event: "*",

            schema:
              "public",

            table:
              "settlements",

            filter:
              `game_id=eq.${gameId}`,
          },
          () => {
            refreshCurrentGame();
          }
        )

        .subscribe(
          (status) => {
            setRealtimeConnected(
              status ===
                "SUBSCRIBED"
            );
          }
        );

    return () => {
      setRealtimeConnected(
        false
      );

      supabase.removeChannel(
        channel
      );
    };
  }, [
    gameId,
    refreshCurrentGame,
  ]);

  // ======================================================
  // JOIN
  // ======================================================

  const joinGame =
    async () => {
      if (
        joining
      ) {
        return;
      }

      const cleaned =
        joinCode
          .trim()
          .toUpperCase();

      if (
        cleaned.length !==
        6
      ) {
        alert(
          "Enter the 6-character room code."
        );

        return;
      }

      setJoining(
        true
      );

      const {
        data,
        error,
      } =
        await supabase.rpc(
          "join_game_by_code",
          {
            input_room_code:
              cleaned,
          }
        );

      if (
        error ||
        !data
      ) {
        alert(
          error?.message ||
            "Room not found."
        );

        setJoining(
          false
        );

        return;
      }

      setJoining(
        false
      );

      router.replace(
        `/?id=${data}`
      );
    };

  // ======================================================
  // CREATE LOCAL PLAYERS
  // ======================================================

  const createPlayers =
    () => {
      if (
        !Number.isInteger(
          numberOfPlayers
        ) ||
        numberOfPlayers <
          2 ||
        numberOfPlayers >
          30
      ) {
        alert(
          "Enter between 2 and 30 players."
        );

        return;
      }

      if (
        !Number.isFinite(
          buyIn
        ) ||
        buyIn <= 0
      ) {
        alert(
          "Enter a valid buy-in."
        );

        return;
      }

      const newPlayers: Player[] =
        Array.from(
          {
            length:
              numberOfPlayers,
          },
          (
            _,
            index
          ) => ({
            id:
              index + 1,

            position:
              index + 1,

            name:
              "",

            rebuys:
              0,

            cashOut:
              0,

            cashOutText:
              "",

            cashOutEntered:
              false,

            active:
              true,
          })
        );

      setPlayers(
        newPlayers
      );
    };

  // ======================================================
  // NAME
  // ======================================================

  const updateName = (
    id: number,
    name: string
  ) => {
    if (
      gameStarted
    ) {
      return;
    }

    setPlayers(
      (previous) =>
        previous.map(
          (player) =>
            player.id ===
            id
              ? {
                  ...player,
                  name,
                }
              : player
        )
    );
  };

  // ======================================================
  // START GAME
  // ======================================================

  const startGame =
    async () => {
      if (
        saving
      ) {
        return;
      }

      if (
        players.length <
        2
      ) {
        alert(
          "Create players first."
        );

        return;
      }

      if (
        players.some(
          (player) =>
            !player.name.trim()
        )
      ) {
        alert(
          "Enter every player's name."
        );

        return;
      }

      const names =
        players.map(
          (player) =>
            player.name
              .trim()
              .toLowerCase()
        );

      if (
        new Set(
          names
        ).size !==
        names.length
      ) {
        alert(
          "Player names must be unique."
        );

        return;
      }

      setSaving(
        true
      );

      const {
        data: {
          session,
        },

        error:
          sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError ||
        !session
      ) {
        setSaving(
          false
        );

        router.replace(
          "/login"
        );

        return;
      }

      const user =
        session.user;

      let createdGame:
        | LoadedGame
        | null =
        null;

      let generatedCode =
        generateRoomCode();

      let gameErrorMessage =
        "";

      for (
        let attempt = 0;
        attempt < 5;
        attempt++
      ) {
        const {
          data,
          error,
        } =
          await supabase
            .from(
              "games"
            )
            .insert({
              user_id:
                user.id,

              buy_in:
                toRupees(
                  toPaise(
                    buyIn
                  )
                ),

              status:
                "active",

              room_code:
                generatedCode,
            })
            .select(`
              id,
              user_id,
              buy_in,
              status,
              room_code
            `)
            .single();

        if (
          !error &&
          data
        ) {
          createdGame =
            data as LoadedGame;

          break;
        }

        gameErrorMessage =
          error?.message ||
          "";

        generatedCode =
          generateRoomCode();
      }

      if (
        !createdGame
      ) {
        alert(
          `Could not create game: ${gameErrorMessage}`
        );

        setSaving(
          false
        );

        return;
      }

      const ordered =
        [...players].sort(
          (a, b) =>
            a.position -
            b.position
        );

      const {
        data:
          insertedPlayers,

        error:
          playerInsertError,
      } =
        await supabase
          .from(
            "players"
          )
          .insert(
            ordered.map(
              (
                player
              ) => ({
                game_id:
                  createdGame!.id,

                position:
                  player.position,

                name:
                  player.name.trim(),

                rebuys:
                  0,

                cash_out:
                  0,

                cash_out_entered:
                  false,

                active:
                  true,
              })
            )
          )
          .select(`
            id,
            position,
            name,
            rebuys,
            cash_out,
            cash_out_entered,
            active,
            created_at
          `);

      if (
        playerInsertError
      ) {
        console.error(
          "PLAYER INSERT:",
          playerInsertError
        );

        await supabase
          .from(
            "games"
          )
          .delete()
          .eq(
            "id",
            createdGame.id
          );

        alert(
          `Could not create players: ${playerInsertError.message}`
        );

        setSaving(
          false
        );

        return;
      }

      const databasePlayers =
        (
          insertedPlayers ||
          []
        ) as PlayerRow[];

      setPlayers(
        ordered.map(
          (player) => {
            const row =
              databasePlayers.find(
                (
                  item
                ) =>
                  item.position ===
                  player.position
              );

            return {
              ...player,

              dbId:
                row?.id,
            };
          }
        )
      );

      setGameId(
        createdGame.id
      );

      setHostUserId(
        user.id
      );

      setCurrentUserId(
        user.id
      );

      setRoomCode(
        generatedCode
      );

      setSavedSettlements(
        []
      );

      setGameStarted(
        true
      );

      setGameFinished(
        false
      );

      setSaving(
        false
      );

      router.replace(
        `/?id=${createdGame.id}`
      );
    };

  // ======================================================
  // ADD PLAYER
  // ======================================================

  const addPlayerMidGame =
    async () => {
      if (
        !isHost ||
        !gameId ||
        gameFinished
      ) {
        return;
      }

      const nextPosition =
        players.length ===
        0
          ? 1
          : Math.max(
              ...players.map(
                (
                  player
                ) =>
                  player.position
              )
            ) + 1;

      const name =
        `Player ${nextPosition}`;

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "players"
          )
          .insert({
            game_id:
              gameId,

            position:
              nextPosition,

            name,

            rebuys:
              0,

            cash_out:
              0,

            cash_out_entered:
              false,

            active:
              true,
          })
          .select(`
            id,
            position,
            name,
            rebuys,
            cash_out,
            cash_out_entered,
            active,
            created_at
          `)
          .single();

      if (
        error ||
        !data
      ) {
        alert(
          `Could not add player: ${
            error?.message ||
            ""
          }`
        );

        return;
      }

      const row =
        data as PlayerRow;

      const player:
        Player = {
        id:
          row.position,

        dbId:
          row.id,

        position:
          row.position,

        name:
          row.name,

        rebuys:
          Number(
            row.rebuys
          ),

        cashOut:
          Number(
            row.cash_out
          ),

        cashOutText:
          "",

        cashOutEntered:
          false,

        active:
          true,
      };

      setPlayers(
        (
          previous
        ) =>
          [
            ...previous,
            player,
          ].sort(
            (a, b) =>
              a.position -
              b.position
          )
      );
    };

  // ======================================================
  // REBUY
  // ======================================================

  const changeRebuy =
    async (
      playerId: number,
      change: number
    ) => {
      if (
        !isHost ||
        gameFinished
      ) {
        return;
      }

      const player =
        players.find(
          (item) =>
            item.id ===
            playerId
        );

      if (
        !player ||
        !player.active
      ) {
        return;
      }

      const newRebuys =
        Math.max(
          0,
          player.rebuys +
            change
        );

      setPlayers(
        (
          previous
        ) =>
          previous
            .map(
              (item) =>
                item.id ===
                playerId
                  ? {
                      ...item,

                      rebuys:
                        newRebuys,
                    }
                  : item
            )
            .sort(
              (a, b) =>
                a.position -
                b.position
            )
      );

      if (
        !player.dbId
      ) {
        return;
      }

      const {
        error,
      } =
        await supabase
          .from(
            "players"
          )
          .update({
            rebuys:
              newRebuys,
          })
          .eq(
            "id",
            player.dbId
          );

      if (error) {
        alert(
          error.message
        );

        await refreshCurrentGame();
      }
    };

  // ======================================================
  // CASH OUT TEXT
  // ======================================================

  const changeCashOutText = (
    playerId: number,
    text: string
  ) => {
    if (
      !isHost ||
      gameFinished
    ) {
      return;
    }

    // only digits + optional decimal + max 2 decimals
    if (
      !/^\d*(\.\d{0,2})?$/.test(
        text
      )
    ) {
      return;
    }

    setPlayers(
      (
        previous
      ) =>
        previous.map(
          (player) => {
            if (
              player.id !==
              playerId
            ) {
              return player;
            }

            if (
              text ===
              ""
            ) {
              return {
                ...player,

                cashOutText:
                  "",

                cashOut:
                  0,

                cashOutEntered:
                  false,
              };
            }

            const numeric =
              Number(text);

            return {
              ...player,

              cashOutText:
                text,

              cashOut:
                Number.isFinite(
                  numeric
                )
                  ? numeric
                  : 0,

              cashOutEntered:
                true,
            };
          }
        )
    );
  };

  // ======================================================
  // SAVE CASH OUT EXACTLY
  // ======================================================

  const saveCashOut =
    async (
      playerId: number
    ) => {
      const player =
        players.find(
          (item) =>
            item.id ===
            playerId
        );

      setEditingCashOutPosition(
        null
      );

      if (
        !player ||
        !isHost ||
        !player.dbId ||
        gameFinished
      ) {
        return;
      }

      if (
        !player.cashOutEntered ||
        player.cashOutText ===
          ""
      ) {
        const {
          error,
        } =
          await supabase
            .from(
              "players"
            )
            .update({
              cash_out:
                0,

              cash_out_entered:
                false,
            })
            .eq(
              "id",
              player.dbId
            );

        if (error) {
          alert(
            error.message
          );
        }

        return;
      }

      const parsed =
        Number(
          player.cashOutText
        );

      if (
        !Number.isFinite(
          parsed
        ) ||
        parsed < 0
      ) {
        alert(
          "Enter a valid cash-out amount."
        );

        return;
      }

      // Exact 2-decimal monetary normalization.
      // 700 -> exactly 700
      const exactCashOut =
        toRupees(
          toPaise(
            parsed
          )
        );

      setPlayers(
        (
          previous
        ) =>
          previous.map(
            (item) =>
              item.id ===
              playerId
                ? {
                    ...item,

                    cashOut:
                      exactCashOut,

                    cashOutText:
                      String(
                        exactCashOut
                      ),

                    cashOutEntered:
                      true,
                  }
                : item
          )
      );

      const {
        error,
      } =
        await supabase
          .from(
            "players"
          )
          .update({
            cash_out:
              exactCashOut,

            cash_out_entered:
              true,
          })
          .eq(
            "id",
            player.dbId
          );

      if (error) {
        console.error(
          "CASHOUT SAVE:",
          error
        );

        alert(
          `Could not save cash-out: ${error.message}`
        );

        await refreshCurrentGame();
      }
    };

  // ======================================================
  // PLAYER LEFT
  // ======================================================

  const markPlayerLeft =
    async (
      playerId: number
    ) => {
      if (
        !isHost ||
        gameFinished
      ) {
        return;
      }

      const player =
        players.find(
          (item) =>
            item.id ===
            playerId
        );

      if (!player) {
        return;
      }

      if (
        !player.cashOutEntered
      ) {
        alert(
          `Enter ${player.name}'s cash-out first. ₹0 is allowed.`
        );

        return;
      }

      // Make sure latest typed value is saved first.
      await saveCashOut(
        playerId
      );

      const latestPlayer =
        players.find(
          (item) =>
            item.id ===
            playerId
        ) ||
        player;

      const confirmed =
        window.confirm(
          `${player.name} is leaving with ${formatMoney(
            latestPlayer.cashOut
          )}. Confirm?`
        );

      if (
        !confirmed
      ) {
        return;
      }

      setPlayers(
        (
          previous
        ) =>
          previous.map(
            (item) =>
              item.id ===
              playerId
                ? {
                    ...item,

                    active:
                      false,
                  }
                : item
          )
      );

      if (
        !player.dbId
      ) {
        return;
      }

      const {
        error,
      } =
        await supabase
          .from(
            "players"
          )
          .update({
            active:
              false,
          })
          .eq(
            "id",
            player.dbId
          );

      if (error) {
        alert(
          error.message
        );

        await refreshCurrentGame();
      }
    };

  // ======================================================
  // REOPEN
  // ======================================================

  const reopenPlayer =
    async (
      playerId: number
    ) => {
      if (
        !isHost ||
        gameFinished
      ) {
        return;
      }

      const player =
        players.find(
          (item) =>
            item.id ===
            playerId
        );

      if (
        !player ||
        !player.dbId
      ) {
        return;
      }

      setPlayers(
        (
          previous
        ) =>
          previous.map(
            (item) =>
              item.id ===
              playerId
                ? {
                    ...item,

                    active:
                      true,
                  }
                : item
          )
      );

      const {
        error,
      } =
        await supabase
          .from(
            "players"
          )
          .update({
            active:
              true,
          })
          .eq(
            "id",
            player.dbId
          );

      if (error) {
        alert(
          error.message
        );

        await refreshCurrentGame();
      }
    };

  // ======================================================
  // CALCULATIONS
  // ======================================================

  const buyInPaise =
    toPaise(
      buyIn
    );

  const totalInvestedPaise =
    useMemo(() => {
      return orderedPlayers.reduce(
        (
          total,
          player
        ) =>
          total +
          buyInPaise *
            (1 +
              player.rebuys),
        0
      );
    }, [
      orderedPlayers,
      buyInPaise,
    ]);

  const totalCashOutPaise =
    useMemo(() => {
      return orderedPlayers.reduce(
        (
          total,
          player
        ) =>
          total +
          toPaise(
            player.cashOut
          ),
        0
      );
    }, [
      orderedPlayers,
    ]);

  const totalInvested =
    toRupees(
      totalInvestedPaise
    );

  const totalCashOut =
    toRupees(
      totalCashOutPaise
    );

  const rawBalances =
    useMemo(() => {
      return orderedPlayers.map(
        (player) => {
          const investedPaise =
            buyInPaise *
            (1 +
              player.rebuys);

          const cashOutPaise =
            toPaise(
              player.cashOut
            );

          const rawProfitPaise =
            cashOutPaise -
            investedPaise;

          return {
            ...player,

            investedPaise,

            cashOutPaise,

            rawProfitPaise,

            invested:
              toRupees(
                investedPaise
              ),

            rawProfit:
              toRupees(
                rawProfitPaise
              ),
          };
        }
      );
    }, [
      orderedPlayers,
      buyInPaise,
    ]);

  const differencePaise =
    totalCashOutPaise -
    totalInvestedPaise;

  const difference =
    toRupees(
      differencePaise
    );

  // ======================================================
  // EQUAL ADJUSTMENT
  // ======================================================

  const adjustedBalances =
    useMemo(() => {
      if (
        orderedPlayers.length ===
        0
      ) {
        return [];
      }

      const adjustmentTotal =
        -differencePaise;

      const base =
        Math.trunc(
          adjustmentTotal /
            orderedPlayers.length
        );

      let remainder =
        adjustmentTotal -
        base *
          orderedPlayers.length;

      return rawBalances.map(
        (player) => {
          let extra =
            0;

          if (
            remainder >
            0
          ) {
            extra =
              1;

            remainder -=
              1;
          } else if (
            remainder <
            0
          ) {
            extra =
              -1;

            remainder +=
              1;
          }

          const adjustmentPaise =
            base +
            extra;

          const adjustedProfitPaise =
            player.rawProfitPaise +
            adjustmentPaise;

          return {
            ...player,

            adjustmentPaise,

            adjustedProfitPaise,

            adjustment:
              toRupees(
                adjustmentPaise
              ),

            adjustedProfit:
              toRupees(
                adjustedProfitPaise
              ),
          };
        }
      );
    }, [
      orderedPlayers.length,
      differencePaise,
      rawBalances,
    ]);

  const finalBalancePaise =
    adjustedBalances.reduce(
      (
        total,
        player
      ) =>
        total +
        player.adjustedProfitPaise,
      0
    );

  const finalBalance =
    toRupees(
      finalBalancePaise
    );

  // ======================================================
  // SETTLEMENTS
  // ======================================================

  const calculatedSettlements =
    useMemo(() => {
      const creditors =
        adjustedBalances
          .filter(
            (player) =>
              player.adjustedProfitPaise >
              0
          )
          .map(
            (player) => ({
              name:
                player.name,

              balance:
                player.adjustedProfitPaise,
            })
          )
          .sort(
            (a, b) =>
              b.balance -
              a.balance
          );

      const debtors =
        adjustedBalances
          .filter(
            (player) =>
              player.adjustedProfitPaise <
              0
          )
          .map(
            (player) => ({
              name:
                player.name,

              balance:
                Math.abs(
                  player.adjustedProfitPaise
                ),
            })
          )
          .sort(
            (a, b) =>
              b.balance -
              a.balance
          );

      const result:
        Settlement[] =
        [];

      let c =
        0;

      let d =
        0;

      while (
        c <
          creditors.length &&
        d <
          debtors.length
      ) {
        const amount =
          Math.min(
            creditors[c]
              .balance,

            debtors[d]
              .balance
          );

        if (
          amount >
          0
        ) {
          result.push({
            from:
              debtors[d]
                .name,

            to:
              creditors[c]
                .name,

            amount:
              toRupees(
                amount
              ),
          });
        }

        creditors[c].balance -=
          amount;

        debtors[d].balance -=
          amount;

        if (
          creditors[c]
            .balance ===
          0
        ) {
          c++;
        }

        if (
          debtors[d]
            .balance ===
          0
        ) {
          d++;
        }
      }

      return result;
    }, [
      adjustedBalances,
    ]);

  // ======================================================
  // FINISH GAME
  // ======================================================

  const finishGame =
    async () => {
      if (
        !isHost ||
        !gameId ||
        saving
      ) {
        return;
      }

      const missing =
        activePlayers.filter(
          (player) =>
            !player.cashOutEntered
        );

      if (
        missing.length >
        0
      ) {
        alert(
          `Enter final cash-out for: ${missing
            .map(
              (player) =>
                player.name
            )
            .join(
              ", "
            )}.`
        );

        return;
      }

      setSaving(
        true
      );

      for (
        const player of
        orderedPlayers
      ) {
        if (
          !player.dbId
        ) {
          continue;
        }

        const {
          error,
        } =
          await supabase
            .from(
              "players"
            )
            .update({
              position:
                player.position,

              name:
                player.name,

              rebuys:
                player.rebuys,

              cash_out:
                toRupees(
                  toPaise(
                    player.cashOut
                  )
                ),

              cash_out_entered:
                player.cashOutEntered,

              active:
                player.active,
            })
            .eq(
              "id",
              player.dbId
            );

        if (error) {
          alert(
            error.message
          );

          setSaving(
            false
          );

          return;
        }
      }

      const {
        error:
          deleteError,
      } =
        await supabase
          .from(
            "settlements"
          )
          .delete()
          .eq(
            "game_id",
            gameId
          );

      if (
        deleteError
      ) {
        alert(
          deleteError.message
        );

        setSaving(
          false
        );

        return;
      }

      if (
        calculatedSettlements.length >
        0
      ) {
        const {
          data,
          error,
        } =
          await supabase
            .from(
              "settlements"
            )
            .insert(
              calculatedSettlements.map(
                (
                  settlement
                ) => ({
                  game_id:
                    gameId,

                  payer_name:
                    settlement.from,

                  receiver_name:
                    settlement.to,

                  amount:
                    settlement.amount,

                  status:
                    "pending",
                })
              )
            )
            .select();

        if (error) {
          alert(
            error.message
          );

          setSaving(
            false
          );

          return;
        }

        setSavedSettlements(
          convertSettlementRows(
            (
              data ||
              []
            ) as SettlementRow[]
          )
        );
      }

      const {
        error:
          gameFinishError,
      } =
        await supabase
          .from(
            "games"
          )
          .update({
            status:
              "finished",

            finished_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            gameId
          );

      if (
        gameFinishError
      ) {
        alert(
          gameFinishError.message
        );

        setSaving(
          false
        );

        return;
      }

      setGameFinished(
        true
      );

      setSaving(
        false
      );
    };

  // ======================================================
  // SETTLEMENT STATUS
  // ======================================================

  const setSettlementStatus =
    async (
      settlement:
        SavedSettlement,

      status:
        | "pending"
        | "paid"
    ) => {
      if (
        !isHost
      ) {
        return;
      }

      const paidAt =
        status ===
        "paid"
          ? new Date().toISOString()
          : null;

      const {
        error,
      } =
        await supabase
          .from(
            "settlements"
          )
          .update({
            status,

            paid_at:
              paidAt,
          })
          .eq(
            "id",
            settlement.id
          );

      if (error) {
        alert(
          error.message
        );

        return;
      }

      setSavedSettlements(
        (
          previous
        ) =>
          previous.map(
            (item) =>
              item.id ===
              settlement.id
                ? {
                    ...item,

                    status,

                    paid_at:
                      paidAt,
                  }
                : item
          )
      );
    };

  // ======================================================
  // PAYMENT STATS
  // ======================================================

  const paidCount =
    savedSettlements.filter(
      (item) =>
        item.status ===
        "paid"
    ).length;

  const pendingCount =
    savedSettlements.length -
    paidCount;

  const totalSettlementPaise =
    savedSettlements.reduce(
      (
        sum,
        item
      ) =>
        sum +
        toPaise(
          item.amount
        ),
      0
    );

  const paidSettlementPaise =
    savedSettlements
      .filter(
        (item) =>
          item.status ===
          "paid"
      )
      .reduce(
        (
          sum,
          item
        ) =>
          sum +
          toPaise(
            item.amount
          ),
        0
      );

  // ======================================================
  // EDIT
  // ======================================================

  const editGame =
    async () => {
      if (
        !isHost ||
        !gameId
      ) {
        return;
      }

      const {
        error,
      } =
        await supabase
          .from(
            "games"
          )
          .update({
            status:
              "active",

            finished_at:
              null,
          })
          .eq(
            "id",
            gameId
          );

      if (error) {
        alert(
          error.message
        );

        return;
      }

      setGameFinished(
        false
      );
    };

  // ======================================================
  // SHARE
  // ======================================================

  const copyRoomCode =
    async () => {
      await navigator.clipboard.writeText(
        roomCode
      );

      alert(
        "Room code copied!"
      );
    };

  const copyRoomLink =
    async () => {
      const link =
        `${window.location.origin}/?room=${roomCode}`;

      await navigator.clipboard.writeText(
        link
      );

      alert(
        "Room link copied!"
      );
    };

  // ======================================================
  // NEW GAME
  // ======================================================

  const startNewGame =
    () => {
      setGameId(
        null
      );

      setPlayers(
        []
      );

      setSavedSettlements(
        []
      );

      setGameStarted(
        false
      );

      setGameFinished(
        false
      );

      setHostUserId(
        null
      );

      setRoomCode(
        ""
      );

      setNumberOfPlayers(
        4
      );

      setBuyIn(
        500
      );

      router.replace(
        "/"
      );
    };

  // ======================================================
  // LOADING
  // ======================================================

  if (
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#061a12] text-white">
        Loading Poker Manager...
      </main>
    );
  }

  // ======================================================
  // UI
  // ======================================================

  return (
    <main className="min-h-screen bg-[#061a12] text-white">

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">

        {/* HEADER */}

        <header className="mb-8 flex flex-col gap-5 border-b border-white/10 pb-6 md:flex-row md:items-center md:justify-between">

          <div>

            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
              ♠ Poker Night
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Poker Manager
            </h1>

            {gameStarted && (
              <div className="mt-3 flex gap-3">

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    realtimeConnected
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-yellow-500/10 text-yellow-400"
                  }`}
                >
                  {realtimeConnected
                    ? "● LIVE SYNC"
                    : "CONNECTING"}
                </span>

                <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-gray-400">
                  {isHost
                    ? "HOST"
                    : "VIEWER"}
                </span>

              </div>
            )}

          </div>

          <div className="flex flex-wrap gap-3">

            <Link
              href="/analytics"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold"
            >
              Analytics
            </Link>

            <Link
              href="/history"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold"
            >
              History
            </Link>

            <Link
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold"
            >
              Dashboard
            </Link>

          </div>

        </header>

        {/* NEW GAME */}

        {!gameStarted && (
          <>

            <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">

              <p className="text-sm uppercase tracking-[0.25em] text-emerald-400">
                Multiplayer
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Join Live Game
              </h2>

              <div className="mt-5 flex gap-3">

                <input
                  value={
                    joinCode
                  }
                  maxLength={
                    6
                  }
                  onChange={(
                    e
                  ) =>
                    setJoinCode(
                      e.target.value
                        .toUpperCase()
                        .replace(
                          /[^A-Z0-9]/g,
                          ""
                        )
                    )
                  }
                  placeholder="ROOM CODE"
                  className="flex-1 rounded-xl border border-white/10 bg-black/20 px-5 py-4"
                />

                <button
                  onClick={
                    joinGame
                  }
                  className="rounded-xl bg-emerald-500 px-8 py-4 font-black text-black"
                >
                  {joining
                    ? "Joining..."
                    : "Join"}
                </button>

              </div>

            </section>

            <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">

              <h2 className="text-3xl font-black">
                Create New Game
              </h2>

              <div className="mt-6 grid gap-5 md:grid-cols-2">

                <div>

                  <label className="mb-2 block text-gray-400">
                    Number of Players
                  </label>

                  <input
                    type="number"
                    value={
                      numberOfPlayers
                    }
                    min={
                      2
                    }
                    max={
                      30
                    }
                    onChange={(
                      e
                    ) =>
                      setNumberOfPlayers(
                        Number(
                          e.target.value
                        )
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-4"
                  />

                </div>

                <div>

                  <label className="mb-2 block text-gray-400">
                    Buy-In
                  </label>

                  <input
                    type="number"
                    value={
                      buyIn
                    }
                    onChange={(
                      e
                    ) =>
                      setBuyIn(
                        Number(
                          e.target.value
                        )
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-4"
                  />

                </div>

              </div>

              <button
                onClick={
                  createPlayers
                }
                className="mt-6 rounded-xl bg-emerald-500 px-6 py-4 font-black text-black"
              >
                Create Players
              </button>

            </section>

            {players.length >
              0 && (
              <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">

                <h2 className="text-3xl font-black">
                  Player Names
                </h2>

                <div className="mt-5 grid gap-4 md:grid-cols-2">

                  {orderedPlayers.map(
                    (
                      player
                    ) => (
                      <input
                        key={
                          player.position
                        }
                        value={
                          player.name
                        }
                        placeholder={`Player ${player.position}`}
                        onChange={(
                          e
                        ) =>
                          updateName(
                            player.id,
                            e.target.value
                          )
                        }
                        className="rounded-xl border border-white/10 bg-black/20 px-4 py-4"
                      />
                    )
                  )}

                </div>

                <button
                  onClick={
                    startGame
                  }
                  disabled={
                    saving
                  }
                  className="mt-6 w-full rounded-xl bg-emerald-500 px-6 py-4 text-lg font-black text-black"
                >
                  {saving
                    ? "Starting..."
                    : "Start Game ♠"}
                </button>

              </section>
            )}

          </>
        )}

        {/* GAME */}

        {gameStarted && (
          <>

            {roomCode &&
              !gameFinished && (
              <section className="mb-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-6">

                <p className="text-sm uppercase tracking-[0.25em] text-emerald-400">
                  Live Room
                </p>

                <div className="mt-3 flex items-center justify-between">

                  <p className="text-4xl font-black tracking-[0.2em]">
                    {roomCode}
                  </p>

                  <div className="flex gap-3">

                    <button
                      onClick={
                        copyRoomCode
                      }
                      className="rounded-xl border border-white/10 px-5 py-3"
                    >
                      Copy Code
                    </button>

                    <button
                      onClick={
                        copyRoomLink
                      }
                      className="rounded-xl bg-emerald-500 px-5 py-3 font-black text-black"
                    >
                      Share Link
                    </button>

                  </div>

                </div>

              </section>
            )}

            {isGuest && (
              <div className="mb-8 rounded-xl bg-blue-500/10 p-5 text-blue-300">
                Viewer Mode — the host controls this game.
              </div>
            )}

            {/* STATS */}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

              <Stat
                title="Players"
                value={String(
                  orderedPlayers.length
                )}
              />

              <Stat
                title="Active"
                value={String(
                  activePlayers.length
                )}
                highlight
              />

              <Stat
                title="Buy-In"
                value={formatMoney(
                  buyIn
                )}
              />

              <Stat
                title="Invested"
                value={formatMoney(
                  totalInvested
                )}
              />

              <Stat
                title="Cash Out"
                value={formatMoney(
                  totalCashOut
                )}
              />

            </section>

            {/* PLAYERS */}

            <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">

              <div className="flex items-center justify-between">

                <div>

                  <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">
                    Live Table
                  </p>

                  <h2 className="mt-1 text-3xl font-black">
                    Players
                  </h2>

                </div>

                {isHost &&
                  !gameFinished && (
                  <button
                    onClick={
                      addPlayerMidGame
                    }
                    className="rounded-xl bg-emerald-500 px-5 py-3 font-black text-black"
                  >
                    + Player
                  </button>
                )}

              </div>

              <div className="mt-6 space-y-5">

                {orderedPlayers.map(
                  (
                    player
                  ) => {
                    const investedPaise =
                      buyInPaise *
                      (1 +
                        player.rebuys);

                    const invested =
                      toRupees(
                        investedPaise
                      );

                    const profit =
                      toRupees(
                        toPaise(
                          player.cashOut
                        ) -
                          investedPaise
                      );

                    return (
                      <div
                        key={
                          player.dbId ||
                          player.position
                        }
                        className={`rounded-2xl border p-5 ${
                          player.active
                            ? "border-white/10 bg-black/20"
                            : "border-yellow-500/20 bg-yellow-500/5"
                        }`}
                      >

                        {/* PLAYER HEADER */}

                        <div className="flex justify-between">

                          <div>

                            <p className="text-xs uppercase text-gray-500">
                              Player
                            </p>

                            <p className="mt-2 text-2xl font-black">
                              {player.name}
                            </p>

                            {!player.active && (
                              <span className="mt-2 inline-block rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-400">
                                LEFT TABLE
                              </span>
                            )}

                          </div>

                          <div className="text-right">

                            <p className="text-xs uppercase text-gray-500">
                              Current P/L
                            </p>

                            <div className="mt-2 text-xl">

                              {player.cashOutEntered ? (
                                <Money
                                  value={
                                    profit
                                  }
                                />
                              ) : (
                                <span className="text-gray-500">
                                  —
                                </span>
                              )}

                            </div>

                          </div>

                        </div>

                        {/* INFO */}

                        <div className="mt-6 grid gap-4 md:grid-cols-3">

                          <InfoBox
                            title="Buy-In"
                            value={formatMoney(
                              buyIn
                            )}
                          />

                          <div className="rounded-xl bg-white/5 p-4">

                            <p className="text-xs uppercase text-gray-500">
                              Rebuys
                            </p>

                            <div className="mt-2 flex items-center gap-3">

                              <button
                                disabled={
                                  !isHost ||
                                  gameFinished ||
                                  !player.active
                                }
                                onClick={() =>
                                  changeRebuy(
                                    player.id,
                                    -1
                                  )
                                }
                                className="h-10 w-10 rounded-lg bg-black/30 font-black disabled:opacity-30"
                              >
                                −
                              </button>

                              <b className="min-w-8 text-center text-xl">
                                {player.rebuys}
                              </b>

                              <button
                                disabled={
                                  !isHost ||
                                  gameFinished ||
                                  !player.active
                                }
                                onClick={() =>
                                  changeRebuy(
                                    player.id,
                                    1
                                  )
                                }
                                className="h-10 w-10 rounded-lg bg-emerald-500 font-black text-black disabled:opacity-30"
                              >
                                +
                              </button>

                            </div>

                          </div>

                          <InfoBox
                            title="Total Invested"
                            value={formatMoney(
                              invested
                            )}
                          />

                        </div>

                        {/* BOTTOM */}

                        <div className="mt-6 flex flex-col gap-5 border-t border-white/10 pt-5 sm:flex-row sm:items-end sm:justify-between">

                          <div>

                            {player.active ? (
                              isHost &&
                              !gameFinished && (
                                <button
                                  onClick={() =>
                                    markPlayerLeft(
                                      player.id
                                    )
                                  }
                                  className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-3 font-bold text-yellow-400"
                                >
                                  Player Left
                                </button>
                              )
                            ) : (
                              <div className="flex gap-3">

                                <span className="py-3 font-bold text-yellow-400">
                                  Player has left
                                </span>

                                {isHost &&
                                  !gameFinished && (
                                    <button
                                      onClick={() =>
                                        reopenPlayer(
                                          player.id
                                        )
                                      }
                                      className="rounded-xl bg-emerald-500/10 px-5 py-3 font-bold text-emerald-400"
                                    >
                                      Reopen
                                    </button>
                                  )}

                              </div>
                            )}

                          </div>

                          {/* CASH OUT */}

                          <div className="w-full sm:w-72">

                            <p className="mb-2 text-xs font-bold uppercase text-gray-500 sm:text-right">
                              Cash Out
                            </p>

                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="Enter amount"

                              value={
                                player.cashOutText
                              }

                              disabled={
                                !isHost ||
                                gameFinished ||
                                !player.active
                              }

                              onFocus={() =>
                                setEditingCashOutPosition(
                                  player.position
                                )
                              }

                              onChange={(e) =>
                                changeCashOutText(
                                  player.id,
                                  e.target.value
                                )
                              }

                              onBlur={() =>
                                saveCashOut(
                                  player.id
                                )
                              }

                              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-right text-lg font-black outline-none focus:border-emerald-500 disabled:opacity-50"
                            />

                            {player.cashOutEntered ? (
                              <p className="mt-2 text-xs text-emerald-400 sm:text-right">
                                ✓ Cash-out entered
                              </p>
                            ) : (
                              <p className="mt-2 text-xs text-yellow-400 sm:text-right">
                                Not entered
                              </p>
                            )}

                          </div>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>

              {/* CURRENT PLAYERS */}

              <PlayerTable
                title="Currently Playing"
                players={
                  activePlayers
                }
                buyInPaise={
                  buyInPaise
                }
              />

              {/* LEFT PLAYERS */}

              {leftPlayers.length >
                0 && (
                <PlayerTable
                  title="Players Who Left"
                  players={
                    leftPlayers
                  }
                  buyInPaise={
                    buyInPaise
                  }
                  left
                />
              )}

              {isHost &&
                !gameFinished && (
                <button
                  onClick={
                    finishGame
                  }
                  disabled={
                    saving
                  }
                  className="mt-10 w-full rounded-xl bg-emerald-500 px-6 py-4 text-lg font-black text-black"
                >
                  {saving
                    ? "Finishing..."
                    : "Finish Game"}
                </button>
              )}

            </section>

            {/* FINAL */}

            {gameFinished && (
              <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">

                <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">
                  Game Complete
                </p>

                <h2 className="mt-2 text-3xl font-black">
                  Final Settlement
                </h2>

                {differencePaise !==
                  0 && (
                  <div className="mt-6 rounded-xl bg-yellow-500/10 p-5">

                    Equal adjustment applied. Difference:{" "}

                    <b>
                      {formatMoney(
                        Math.abs(
                          difference
                        )
                      )}
                    </b>

                  </div>
                )}

                <h3 className="mt-8 text-2xl font-black">
                  Who Pays Whom
                </h3>

                {savedSettlements.length >
                0 ? (
                  <div className="mt-5 space-y-3">

                    {savedSettlements.map(
                      (
                        settlement
                      ) => (
                        <div
                          key={
                            settlement.id
                          }
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-5"
                        >

                          <div>

                            <b className="text-red-400">
                              {settlement.payer_name}
                            </b>

                            {" → "}

                            <b className="text-emerald-400">
                              {settlement.receiver_name}
                            </b>

                            <p className="mt-2 text-xl font-black">
                              {formatMoney(
                                settlement.amount
                              )}
                            </p>

                          </div>

                          {settlement.status ===
                          "paid" ? (
                            <div className="flex gap-2">

                              <span className="rounded-xl bg-emerald-500/10 px-4 py-3 font-bold text-emerald-400">
                                ✓ Paid
                              </span>

                              {isHost && (
                                <button
                                  onClick={() =>
                                    setSettlementStatus(
                                      settlement,
                                      "pending"
                                    )
                                  }
                                  className="rounded-xl bg-white/5 px-4 py-3"
                                >
                                  Undo
                                </button>
                              )}

                            </div>
                          ) : (
                            isHost && (
                              <button
                                onClick={() =>
                                  setSettlementStatus(
                                    settlement,
                                    "paid"
                                  )
                                }
                                className="rounded-xl bg-emerald-500 px-5 py-3 font-black text-black"
                              >
                                Mark Paid
                              </button>
                            )
                          )}

                        </div>
                      )
                    )}

                  </div>
                ) : (
                  <p className="mt-5 text-emerald-400">
                    ✓ No payments required
                  </p>
                )}

                {/* PAYMENT SUMMARY */}

                {savedSettlements.length >
                  0 && (
                  <div className="mt-6 grid gap-4 md:grid-cols-3">

                    <InfoBox
                      title={`${paidCount} Paid`}
                      value={formatMoney(
                        toRupees(
                          paidSettlementPaise
                        )
                      )}
                    />

                    <InfoBox
                      title={`${pendingCount} Pending`}
                      value={formatMoney(
                        toRupees(
                          totalSettlementPaise -
                            paidSettlementPaise
                        )
                      )}
                    />

                    <InfoBox
                      title="Total"
                      value={formatMoney(
                        toRupees(
                          totalSettlementPaise
                        )
                      )}
                    />

                  </div>
                )}

                {/* FINAL TABLE */}

                <div className="mt-8 overflow-x-auto rounded-xl border border-white/10">

                  <div className="min-w-[850px]">

                    <div className="grid grid-cols-6 bg-black/30 px-5 py-4 text-xs uppercase text-gray-500">

                      <span>
                        Player
                      </span>

                      <span>
                        Invested
                      </span>

                      <span>
                        Cash Out
                      </span>

                      <span>
                        Raw P/L
                      </span>

                      <span>
                        Adjustment
                      </span>

                      <span>
                        Final P/L
                      </span>

                    </div>

                    {adjustedBalances.map(
                      (
                        player
                      ) => (
                        <div
                          key={
                            player.position
                          }
                          className="grid grid-cols-6 border-t border-white/10 px-5 py-4"
                        >

                          <b>
                            {player.name}
                          </b>

                          <span>
                            {formatMoney(
                              player.invested
                            )}
                          </span>

                          <span>
                            {formatMoney(
                              player.cashOut
                            )}
                          </span>

                          <Money
                            value={
                              player.rawProfit
                            }
                          />

                          <Money
                            value={
                              player.adjustment
                            }
                          />

                          <Money
                            value={
                              player.adjustedProfit
                            }
                          />

                        </div>
                      )
                    )}

                  </div>

                </div>

                <div className="mt-6 rounded-xl bg-emerald-500/5 p-5">

                  Final Balance:

                  <div className="mt-2 text-2xl">

                    <Money
                      value={
                        finalBalance
                      }
                    />

                  </div>

                  {finalBalancePaise ===
                    0 && (
                    <p className="mt-2 text-emerald-400">
                      ✓ Table balances exactly
                    </p>
                  )}

                </div>

                {isHost && (
                  <div className="mt-6 grid gap-3 md:grid-cols-2">

                    <button
                      onClick={
                        editGame
                      }
                      className="rounded-xl bg-white/5 px-6 py-4 font-bold"
                    >
                      Edit Game
                    </button>

                    <button
                      onClick={
                        startNewGame
                      }
                      className="rounded-xl bg-emerald-500 px-6 py-4 font-black text-black"
                    >
                      + New Game
                    </button>

                  </div>
                )}

              </section>
            )}

          </>
        )}

      </div>

    </main>
  );
}

// ======================================================
// COMPONENTS
// ======================================================

function Stat({
  title,
  value,
  highlight,
}: {
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">

      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p
        className={`mt-2 text-2xl font-black ${
          highlight
            ? "text-emerald-400"
            : ""
        }`}
      >
        {value}
      </p>

    </div>
  );
}

function InfoBox({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white/5 p-4">

      <p className="text-xs uppercase text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-lg font-black">
        {value}
      </p>

    </div>
  );
}

function Money({
  value,
}: {
  value: number;
}) {
  const paise =
    toPaise(
      value
    );

  return (
    <span
      className={`font-black ${
        paise > 0
          ? "text-emerald-400"
          : paise < 0
          ? "text-red-400"
          : "text-gray-400"
      }`}
    >
      {paise > 0
        ? "+"
        : ""}

      {formatMoney(
        toRupees(
          paise
        )
      )}
    </span>
  );
}

function PlayerTable({
  title,
  players,
  buyInPaise,
  left = false,
}: {
  title: string;

  players: Player[];

  buyInPaise: number;

  left?: boolean;
}) {
  return (
    <div className="mt-10">

      <h3
        className={`text-2xl font-black ${
          left
            ? "text-yellow-300"
            : ""
        }`}
      >
        {title}
      </h3>

      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">

        <div className="min-w-[650px]">

          <div className="grid grid-cols-5 bg-black/30 px-5 py-4 text-xs uppercase text-gray-500">

            <span>
              Player
            </span>

            <span>
              Rebuys
            </span>

            <span>
              Invested
            </span>

            <span>
              Cash Out
            </span>

            <span>
              P/L
            </span>

          </div>

          {players.map(
            (
              player
            ) => {
              const investedPaise =
                buyInPaise *
                (1 +
                  player.rebuys);

              const profitPaise =
                toPaise(
                  player.cashOut
                ) -
                investedPaise;

              return (
                <div
                  key={
                    player.position
                  }
                  className="grid grid-cols-5 border-t border-white/10 px-5 py-4"
                >

                  <b>
                    {player.name}
                  </b>

                  <span>
                    {player.rebuys}
                  </span>

                  <span>
                    {formatMoney(
                      toRupees(
                        investedPaise
                      )
                    )}
                  </span>

                  <span>
                    {player.cashOutEntered
                      ? formatMoney(
                          player.cashOut
                        )
                      : "—"}
                  </span>

                  {player.cashOutEntered ? (
                    <Money
                      value={toRupees(
                        profitPaise
                      )}
                    />
                  ) : (
                    <span className="text-gray-500">
                      —
                    </span>
                  )}

                </div>
              );
            }
          )}

        </div>

      </div>

    </div>
  );
}

// ======================================================
// SUSPENSE
// ======================================================

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#061a12] text-white">
          Loading Poker Manager...
        </main>
      }
    >
      <PokerManager />
    </Suspense>
  );
}