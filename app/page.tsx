"use client";

import {
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

// =====================================
// MONEY HELPERS
// =====================================

const toPaise = (rupees: number) => {
  return Math.round(rupees * 100);
};

const toRupees = (paise: number) => {
  return paise / 100;
};

// =====================================
// TYPES
// =====================================

type Player = {
  id: number;
  dbId?: string;
  name: string;
  rebuys: number;
  cashOut: number;
  cashOutEntered: boolean;
  active: boolean;
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

type LoadedGame = {
  id: string;
  user_id: string;
  buy_in: number;
  status: string;
  room_code: string | null;
};

// =====================================
// PAGE
// =====================================

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [
    numberOfPlayers,
    setNumberOfPlayers,
  ] = useState(4);

  const [
    buyIn,
    setBuyIn,
  ] = useState(500);

  const [
    players,
    setPlayers,
  ] = useState<Player[]>([]);

  const [
    savedSettlements,
    setSavedSettlements,
  ] = useState<SavedSettlement[]>([]);

  const [
    gameStarted,
    setGameStarted,
  ] = useState(false);

  const [
    gameFinished,
    setGameFinished,
  ] = useState(false);

  const [
    gameId,
    setGameId,
  ] = useState<string | null>(null);

  const [
    hostUserId,
    setHostUserId,
  ] = useState<string | null>(null);

  const [
    currentUserId,
    setCurrentUserId,
  ] = useState<string | null>(null);

  const [
    roomCode,
    setRoomCode,
  ] = useState("");

  const [
    joinCode,
    setJoinCode,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    joining,
    setJoining,
  ] = useState(false);

  const [
    realtimeConnected,
    setRealtimeConnected,
  ] = useState(false);

  // =====================================
  // HOST / VIEWER
  // =====================================

  const isHost =
    !!currentUserId &&
    !!hostUserId &&
    currentUserId === hostUserId;

  const isGuest =
    gameStarted &&
    !!currentUserId &&
    !!hostUserId &&
    currentUserId !== hostUserId;

  // =====================================
  // ROOM CODE
  // =====================================

  const generateRoomCode = () => {
    const characters =
      "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let result = "";

    for (let i = 0; i < 6; i++) {
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

  // =====================================
  // CREATE ROOM CODE FOR OLD GAMES
  // =====================================

  const createRoomCodeForExistingGame =
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
        } = await supabase
          .from("games")
          .update({
            room_code: newCode,
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
    };

  // =====================================
  // LOAD EXISTING GAME
  // =====================================

  const loadExistingGame =
    useCallback(
      async (
        existingGameId: string,
        userId?: string
      ) => {
        const {
          data: game,
          error: gameError,
        } = await supabase
          .from("games")
          .select(
            `
            id,
            user_id,
            buy_in,
            status,
            room_code
            `
          )
          .eq(
            "id",
            existingGameId
          )
          .single();

        if (
          gameError ||
          !game
        ) {
          console.error(
            gameError
          );

          alert(
            "Game could not be found or you do not have access."
          );

          router.push(
            "/dashboard"
          );

          return;
        }

        const typedGame =
          game as LoadedGame;

        const {
          data: savedPlayers,
          error: playerError,
        } = await supabase
          .from("players")
          .select(
            `
            id,
            name,
            rebuys,
            cash_out,
            cash_out_entered,
            active,
            created_at
            `
          )
          .eq(
            "game_id",
            existingGameId
          )
          .order(
            "created_at",
            {
              ascending: true,
            }
          );

        if (playerError) {
          console.error(
            playerError
          );

          alert(
            "Could not load players."
          );

          setLoading(false);

          return;
        }

        const {
          data: settlementData,
          error: settlementError,
        } = await supabase
          .from("settlements")
          .select("*")
          .eq(
            "game_id",
            existingGameId
          )
          .order(
            "created_at",
            {
              ascending: true,
            }
          );

        if (
          settlementError
        ) {
          console.error(
            "Settlement load error:",
            settlementError
          );
        }

        const loadedPlayers: Player[] =
          (
            savedPlayers || []
          ).map(
            (
              player,
              index
            ) => ({
              id:
                index + 1,

              dbId:
                player.id,

              name:
                player.name,

              rebuys:
                Number(
                  player.rebuys || 0
                ),

              cashOut:
                Number(
                  player.cash_out || 0
                ),

              cashOutEntered:
                Boolean(
                  player.cash_out_entered
                ),

              active:
                player.active,
            })
          );

        const loadedSettlements: SavedSettlement[] =
          (
            settlementData || []
          ).map(
            (item) => ({
              ...item,

              amount:
                Number(
                  item.amount
                ),
            })
          );

        setGameId(
          typedGame.id
        );

        setHostUserId(
          typedGame.user_id
        );

        setBuyIn(
          Number(
            typedGame.buy_in
          )
        );

        setRoomCode(
          typedGame.room_code ||
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
          typedGame.status ===
            "finished"
        );

        if (
          !typedGame.room_code &&
          userId ===
            typedGame.user_id &&
          typedGame.status ===
            "active"
        ) {
          await createRoomCodeForExistingGame(
            typedGame.id
          );
        }

        setLoading(false);
      },
      [router]
    );

  // =====================================
  // INITIAL LOAD
  // =====================================

  useEffect(() => {
    const loadPage =
      async () => {
        setLoading(true);

        const {
          data: {
            user,
          },
        } =
          await supabase.auth.getUser();

        if (!user) {
          router.push(
            "/login"
          );

          return;
        }

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
            room.toUpperCase()
          );

          setLoading(false);

          return;
        }

        if (!id) {
          setLoading(false);

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

  // =====================================
  // REALTIME REFRESH
  // =====================================

  const refreshCurrentGame =
    useCallback(
      async () => {
        if (!gameId)
          return;

        const {
          data: game,
        } = await supabase
          .from("games")
          .select(
            `
            id,
            user_id,
            buy_in,
            status,
            room_code
            `
          )
          .eq(
            "id",
            gameId
          )
          .single();

        if (!game)
          return;

        const {
          data: savedPlayers,
        } = await supabase
          .from("players")
          .select(
            `
            id,
            name,
            rebuys,
            cash_out,
            cash_out_entered,
            active,
            created_at
            `
          )
          .eq(
            "game_id",
            gameId
          )
          .order(
            "created_at",
            {
              ascending: true,
            }
          );

        const {
          data:
            settlementData,
        } = await supabase
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
              ascending: true,
            }
          );

        const loadedPlayers: Player[] =
          (
            savedPlayers || []
          ).map(
            (
              player,
              index
            ) => ({
              id:
                index + 1,

              dbId:
                player.id,

              name:
                player.name,

              rebuys:
                Number(
                  player.rebuys ||
                    0
                ),

              cashOut:
                Number(
                  player.cash_out ||
                    0
                ),

              cashOutEntered:
                Boolean(
                  player.cash_out_entered
                ),

              active:
                player.active,
            })
          );

        const loadedSettlements: SavedSettlement[] =
          (
            settlementData ||
            []
          ).map(
            (item) => ({
              ...item,

              amount:
                Number(
                  item.amount
                ),
            })
          );

        setPlayers(
          loadedPlayers
        );

        setSavedSettlements(
          loadedSettlements
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
      [gameId]
    );

  // =====================================
  // REALTIME SUBSCRIPTION
  // =====================================

  useEffect(() => {
    if (!gameId)
      return;

    const channel =
      supabase
        .channel(
          `poker-${gameId}`
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "players",
            filter: `game_id=eq.${gameId}`,
          },
          refreshCurrentGame
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "games",
            filter: `id=eq.${gameId}`,
          },
          refreshCurrentGame
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "settlements",
            filter: `game_id=eq.${gameId}`,
          },
          refreshCurrentGame
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

  // =====================================
  // JOIN GAME
  // =====================================

  const joinGame =
    async () => {
      if (joining)
        return;

      const cleanedCode =
        joinCode
          .trim()
          .toUpperCase();

      if (
        cleanedCode.length !==
        6
      ) {
        alert(
          "Enter the 6-character room code."
        );

        return;
      }

      setJoining(true);

      const {
        data,
        error,
      } =
        await supabase.rpc(
          "join_game_by_code",
          {
            input_room_code:
              cleanedCode,
          }
        );

      if (
        error ||
        !data
      ) {
        console.error(
          error
        );

        alert(
          "Room not found or this game is no longer active."
        );

        setJoining(false);

        return;
      }

      setJoining(false);

      router.replace(
        `/?id=${data}`
      );
    };

  // =====================================
  // CREATE PLAYER INPUTS
  // =====================================

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

      const newPlayers =
        Array.from(
          {
            length:
              numberOfPlayers,
          },
          (
            _,
            index
          ): Player => ({
            id:
              index + 1,

            name: "",

            rebuys: 0,

            cashOut: 0,

            cashOutEntered:
              false,

            active: true,
          })
        );

      setPlayers(
        newPlayers
      );
    };

  // =====================================
  // PLAYER NAME
  // =====================================

  const updateName = (
    id: number,
    name: string
  ) => {
    if (
      gameStarted &&
      !isHost
    )
      return;

    setPlayers(
      (
        previous
      ) =>
        previous.map(
          (
            player
          ) =>
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

  // =====================================
  // START GAME
  // =====================================

  const startGame =
    async () => {
      if (saving)
        return;

      if (
        players.some(
          (
            player
          ) =>
            !player.name.trim()
        )
      ) {
        alert(
          "Enter every player's name."
        );

        return;
      }

      const normalizedNames =
        players.map(
          (
            player
          ) =>
            player.name
              .trim()
              .toLowerCase()
        );

      if (
        new Set(
          normalizedNames
        ).size !==
        normalizedNames.length
      ) {
        alert(
          "Player names must be unique."
        );

        return;
      }

      setSaving(true);

      const {
        data: {
          user,
        },
      } =
        await supabase.auth.getUser();

      if (!user) {
        setSaving(false);

        router.push(
          "/login"
        );

        return;
      }

      let createdGame:
        | LoadedGame
        | null = null;

      let generatedCode =
        generateRoomCode();

      for (
        let attempt = 0;
        attempt < 5;
        attempt++
      ) {
        const {
          data,
          error,
        } = await supabase
          .from("games")
          .insert({
            user_id:
              user.id,

            buy_in:
              buyIn,

            status:
              "active",

            room_code:
              generatedCode,
          })
          .select(
            `
            id,
            user_id,
            buy_in,
            status,
            room_code
            `
          )
          .single();

        if (
          !error &&
          data
        ) {
          createdGame =
            data as LoadedGame;

          break;
        }

        generatedCode =
          generateRoomCode();
      }

      if (
        !createdGame
      ) {
        alert(
          "Could not create game."
        );

        setSaving(false);

        return;
      }

      const {
        data:
          createdPlayers,
        error:
          playersError,
      } = await supabase
        .from("players")
        .insert(
          players.map(
            (
              player
            ) => ({
              game_id:
                createdGame!.id,

              name:
                player.name.trim(),

              rebuys: 0,

              cash_out: 0,

              cash_out_entered:
                false,

              active: true,
            })
          )
        )
        .select();

      if (
        playersError
      ) {
        console.error(
          playersError
        );

        await supabase
          .from("games")
          .delete()
          .eq(
            "id",
            createdGame.id
          );

        alert(
          "Could not create players."
        );

        setSaving(false);

        return;
      }

      setPlayers(
        players.map(
          (
            player,
            index
          ) => ({
            ...player,

            dbId:
              createdPlayers?.[
                index
              ]?.id,
          })
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

      setSaving(false);

      router.replace(
        `/?id=${createdGame.id}`
      );
    };

  // =====================================
  // SAVE PLAYER NAME
  // =====================================

  const savePlayerName =
    async (
      player: Player
    ) => {
      if (
        !isHost ||
        !player.dbId
      )
        return;

      const name =
        player.name.trim();

      if (!name)
        return;

      const {
        error,
      } = await supabase
        .from("players")
        .update({
          name,
        })
        .eq(
          "id",
          player.dbId
        );

      if (error) {
        console.error(
          "Name save error:",
          error
        );
      }
    };

  // =====================================
  // ADD PLAYER MID-GAME
  // =====================================

  const addPlayerMidGame =
    async () => {
      if (
        !isHost ||
        !gameId ||
        gameFinished
      )
        return;

      const nextId =
        players.length ===
        0
          ? 1
          : Math.max(
              ...players.map(
                (
                  player
                ) =>
                  player.id
              )
            ) + 1;

      const name =
        `Player ${nextId}`;

      const {
        data,
        error,
      } = await supabase
        .from("players")
        .insert({
          game_id:
            gameId,

          name,

          rebuys: 0,

          cash_out: 0,

          cash_out_entered:
            false,

          active: true,
        })
        .select()
        .single();

      if (
        error ||
        !data
      ) {
        console.error(
          error
        );

        alert(
          "Could not add player."
        );

        return;
      }

      setPlayers(
        (
          previous
        ) => [
          ...previous,

          {
            id:
              nextId,

            dbId:
              data.id,

            name,

            rebuys: 0,

            cashOut: 0,

            cashOutEntered:
              false,

            active: true,
          },
        ]
      );
    };

  // =====================================
  // REBUYS
  // =====================================

  const changeRebuy =
    async (
      id: number,
      change: number
    ) => {
      if (
        !isHost ||
        gameFinished
      )
        return;

      const player =
        players.find(
          (
            item
          ) =>
            item.id ===
            id
        );

      if (
        !player ||
        !player.active
      )
        return;

      const newValue =
        Math.max(
          0,
          player.rebuys +
            change
        );

      setPlayers(
        (
          previous
        ) =>
          previous.map(
            (
              item
            ) =>
              item.id ===
              id
                ? {
                    ...item,

                    rebuys:
                      newValue,
                  }
                : item
          )
      );

      if (
        player.dbId
      ) {
        const {
          error,
        } = await supabase
          .from("players")
          .update({
            rebuys:
              newValue,
          })
          .eq(
            "id",
            player.dbId
          );

        if (error) {
          console.error(
            "Rebuy save error:",
            error
          );
        }
      }
    };

  // =====================================
  // CASH OUT
  // =====================================

  const updateCashOut = (
    id: number,
    value: number
  ) => {
    if (
      !isHost ||
      gameFinished
    )
      return;

    if (
      !Number.isFinite(
        value
      ) ||
      value < 0
    )
      return;

    const safeValue =
      toRupees(
        toPaise(value)
      );

    setPlayers(
      (
        previous
      ) =>
        previous.map(
          (
            player
          ) =>
            player.id ===
            id
              ? {
                  ...player,

                  cashOut:
                    safeValue,

                  cashOutEntered:
                    true,
                }
              : player
        )
    );
  };

  const clearCashOut = (
    id: number
  ) => {
    if (
      !isHost ||
      gameFinished
    )
      return;

    setPlayers(
      (
        previous
      ) =>
        previous.map(
          (
            player
          ) =>
            player.id ===
            id
              ? {
                  ...player,

                  cashOut: 0,

                  cashOutEntered:
                    false,
                }
              : player
        )
    );
  };

  const saveCashOut =
    async (
      player: Player
    ) => {
      if (
        !isHost ||
        !player.dbId
      )
        return;

      const {
        error,
      } = await supabase
        .from("players")
        .update({
          cash_out:
            player.cashOutEntered
              ? player.cashOut
              : 0,

          cash_out_entered:
            player.cashOutEntered,
        })
        .eq(
          "id",
          player.dbId
        );

      if (error) {
        console.error(
          "Cash-out save error:",
          error
        );
      }
    };

  // =====================================
  // PLAYER LEFT
  // =====================================

  const markPlayerLeft =
    async (
      id: number
    ) => {
      if (
        !isHost ||
        gameFinished
      )
        return;

      const player =
        players.find(
          (
            item
          ) =>
            item.id ===
            id
        );

      if (!player)
        return;

      if (
        !player.cashOutEntered
      ) {
        alert(
          `Enter ${player.name}'s cash-out before marking them as left. ₹0 is allowed.`
        );

        return;
      }

      const confirmLeave =
        window.confirm(
          `${player.name} is leaving with ₹${player.cashOut.toLocaleString(
            "en-IN",
            {
              minimumFractionDigits:
                0,
              maximumFractionDigits:
                2,
            }
          )}. Confirm?`
        );

      if (!confirmLeave)
        return;

      setPlayers(
        (
          previous
        ) =>
          previous.map(
            (
              item
            ) =>
              item.id ===
              id
                ? {
                    ...item,

                    active:
                      false,
                  }
                : item
          )
      );

      if (
        player.dbId
      ) {
        const {
          error,
        } = await supabase
          .from("players")
          .update({
            active:
              false,

            cash_out:
              player.cashOut,

            cash_out_entered:
              true,
          })
          .eq(
            "id",
            player.dbId
          );

        if (error) {
          console.error(
            "Player leave save error:",
            error
          );
        }
      }
    };

  // =====================================
  // REOPEN PLAYER
  // =====================================

  const reopenPlayer =
    async (
      id: number
    ) => {
      if (
        !isHost ||
        gameFinished
      )
        return;

      const player =
        players.find(
          (
            item
          ) =>
            item.id ===
            id
        );

      if (!player)
        return;

      setPlayers(
        (
          previous
        ) =>
          previous.map(
            (
              item
            ) =>
              item.id ===
              id
                ? {
                    ...item,
                    active:
                      true,
                  }
                : item
          )
      );

      if (
        player.dbId
      ) {
        const {
          error,
        } = await supabase
          .from("players")
          .update({
            active: true,
          })
          .eq(
            "id",
            player.dbId
          );

        if (error) {
          console.error(
            "Reopen player error:",
            error
          );
        }
      }
    };

  // =====================================
  // PAISE-SAFE MONEY CALCULATIONS
  // =====================================

  const buyInPaise =
    toPaise(buyIn);

  const totalInvestedPaise =
    useMemo(() => {
      return players.reduce(
        (
          total,
          player
        ) => {
          const invested =
            buyInPaise *
            (1 +
              player.rebuys);

          return (
            total +
            invested
          );
        },
        0
      );
    }, [
      players,
      buyInPaise,
    ]);

  const totalCashOutPaise =
    useMemo(() => {
      return players.reduce(
        (
          total,
          player
        ) => {
          return (
            total +
            toPaise(
              player.cashOut
            )
          );
        },
        0
      );
    }, [players]);

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
      return players.map(
        (
          player
        ) => {
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
      players,
      buyInPaise,
    ]);

  // =====================================
  // DIFFERENCE
  // =====================================

  const differencePaise =
    totalCashOutPaise -
    totalInvestedPaise;

  const difference =
    toRupees(
      differencePaise
    );

  // =====================================
  // EXACT EQUAL ADJUSTMENT
  // =====================================
  //
  // Example:
  // Missing ₹1 among 3 players:
  //
  // +₹0.34
  // +₹0.33
  // +₹0.33
  //
  // Total = exactly ₹1
  //
  // No floating point imbalance.
  // =====================================

  const adjustedBalances =
    useMemo(() => {
      if (
        players.length ===
        0
      ) {
        return [];
      }

      const adjustmentTotalPaise =
        -differencePaise;

      const baseAdjustmentPaise =
        Math.trunc(
          adjustmentTotalPaise /
            players.length
        );

      let remainingPaise =
        adjustmentTotalPaise -
        baseAdjustmentPaise *
          players.length;

      return rawBalances.map(
        (
          player
        ) => {
          let extraPaise =
            0;

          if (
            remainingPaise >
            0
          ) {
            extraPaise =
              1;

            remainingPaise -=
              1;
          } else if (
            remainingPaise <
            0
          ) {
            extraPaise =
              -1;

            remainingPaise +=
              1;
          }

          const adjustmentPaise =
            baseAdjustmentPaise +
            extraPaise;

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
      players.length,
      differencePaise,
      rawBalances,
    ]);

  // =====================================
  // DISPLAY ADJUSTMENT VALUE
  // =====================================

  const adjustmentPerPlayer =
    players.length ===
    0
      ? 0
      : toRupees(
          Math.round(
            -differencePaise /
              players.length
          )
        );

  // =====================================
  // FINAL BALANCE
  // =====================================

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

  // =====================================
  // ACTIVE PLAYERS
  // =====================================

  const activePlayersCount =
    useMemo(
      () =>
        players.filter(
          (
            player
          ) =>
            player.active
        ).length,
      [players]
    );

  // =====================================
  // SETTLEMENT CALCULATION
  // =====================================

  const calculatedSettlements =
    useMemo(() => {
      const creditors =
        adjustedBalances
          .filter(
            (
              player
            ) =>
              player.adjustedProfitPaise >
              0
          )
          .map(
            (
              player
            ) => ({
              name:
                player.name,

              balancePaise:
                player.adjustedProfitPaise,
            })
          )
          .sort(
            (
              a,
              b
            ) =>
              b.balancePaise -
              a.balancePaise
          );

      const debtors =
        adjustedBalances
          .filter(
            (
              player
            ) =>
              player.adjustedProfitPaise <
              0
          )
          .map(
            (
              player
            ) => ({
              name:
                player.name,

              balancePaise:
                Math.abs(
                  player.adjustedProfitPaise
                ),
            })
          )
          .sort(
            (
              a,
              b
            ) =>
              b.balancePaise -
              a.balancePaise
          );

      const result: Settlement[] =
        [];

      let creditorIndex =
        0;

      let debtorIndex =
        0;

      while (
        creditorIndex <
          creditors.length &&
        debtorIndex <
          debtors.length
      ) {
        const creditor =
          creditors[
            creditorIndex
          ];

        const debtor =
          debtors[
            debtorIndex
          ];

        const amountPaise =
          Math.min(
            creditor.balancePaise,
            debtor.balancePaise
          );

        if (
          amountPaise >
          0
        ) {
          result.push({
            from:
              debtor.name,

            to:
              creditor.name,

            amount:
              toRupees(
                amountPaise
              ),
          });
        }

        creditor.balancePaise -=
          amountPaise;

        debtor.balancePaise -=
          amountPaise;

        if (
          creditor.balancePaise ===
          0
        ) {
          creditorIndex++;
        }

        if (
          debtor.balancePaise ===
          0
        ) {
          debtorIndex++;
        }
      }

      return result;
    }, [
      adjustedBalances,
    ]);

  // =====================================
  // FINISH GAME
  // =====================================

  const finishGame =
    async () => {
      if (
        !isHost ||
        !gameId ||
        saving
      )
        return;

      const missingCashOut =
        players.filter(
          (
            player
          ) =>
            player.active &&
            !player.cashOutEntered
        );

      if (
        missingCashOut.length >
        0
      ) {
        alert(
          `Enter final cash-out for: ${missingCashOut
            .map(
              (
                player
              ) =>
                player.name
            )
            .join(
              ", "
            )}. ₹0 is allowed.`
        );

        return;
      }

      setSaving(true);

      // SAVE PLAYERS

      for (
        const player of
        players
      ) {
        if (
          !player.dbId
        )
          continue;

        const {
          error,
        } = await supabase
          .from("players")
          .update({
            name:
              player.name.trim(),

            rebuys:
              player.rebuys,

            cash_out:
              player.cashOut,

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
          console.error(
            error
          );

          alert(
            `Could not save ${player.name}.`
          );

          setSaving(false);

          return;
        }
      }

      // DELETE OLD SETTLEMENTS

      const {
        error:
          deleteError,
      } = await supabase
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
        console.error(
          deleteError
        );

        alert(
          "Could not recalculate settlements."
        );

        setSaving(false);

        return;
      }

      // SAVE NEW SETTLEMENTS

      if (
        calculatedSettlements.length >
        0
      ) {
        const {
          data,
          error,
        } = await supabase
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
          console.error(
            error
          );

          alert(
            "Could not save settlement."
          );

          setSaving(false);

          return;
        }

        setSavedSettlements(
          (
            data || []
          ).map(
            (
              item
            ) => ({
              ...item,

              amount:
                Number(
                  item.amount
                ),
            })
          )
        );
      } else {
        setSavedSettlements(
          []
        );
      }

      // FINISH GAME

      const {
        error:
          gameError,
      } = await supabase
        .from("games")
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
        gameError
      ) {
        console.error(
          gameError
        );

        alert(
          "Could not finish game."
        );

        setSaving(false);

        return;
      }

      setGameFinished(
        true
      );

      setSaving(false);
    };

  // =====================================
  // SETTLEMENT PAYMENT STATUS
  // =====================================

  const setSettlementStatus =
    async (
      settlement:
        SavedSettlement,
      status:
        | "pending"
        | "paid"
    ) => {
      if (
        !isHost ||
        saving
      )
        return;

      const paidAt =
        status === "paid"
          ? new Date().toISOString()
          : null;

      setSavedSettlements(
        (
          previous
        ) =>
          previous.map(
            (
              item
            ) =>
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

      const {
        error,
      } = await supabase
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
        console.error(
          error
        );

        alert(
          "Could not update payment."
        );

        await refreshCurrentGame();
      }
    };

  // =====================================
  // PAYMENT SUMMARY
  // =====================================

  const paidSettlementCount =
    savedSettlements.filter(
      (
        settlement
      ) =>
        settlement.status ===
        "paid"
    ).length;

  const pendingSettlementCount =
    savedSettlements.length -
    paidSettlementCount;

  const totalSettlementAmountPaise =
    savedSettlements.reduce(
      (
        total,
        settlement
      ) =>
        total +
        toPaise(
          settlement.amount
        ),
      0
    );

  const paidSettlementAmountPaise =
    savedSettlements
      .filter(
        (
          settlement
        ) =>
          settlement.status ===
          "paid"
      )
      .reduce(
        (
          total,
          settlement
        ) =>
          total +
          toPaise(
            settlement.amount
          ),
        0
      );

  const remainingSettlementAmountPaise =
    totalSettlementAmountPaise -
    paidSettlementAmountPaise;

  const totalSettlementAmount =
    toRupees(
      totalSettlementAmountPaise
    );

  const paidSettlementAmount =
    toRupees(
      paidSettlementAmountPaise
    );

  const remainingSettlementAmount =
    toRupees(
      remainingSettlementAmountPaise
    );

  // =====================================
  // EDIT GAME
  // =====================================

  const editGame =
    async () => {
      if (
        !isHost ||
        !gameId
      )
        return;

      const {
        error,
      } = await supabase
        .from("games")
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
        console.error(
          error
        );

        alert(
          "Could not reopen game."
        );

        return;
      }

      setGameFinished(
        false
      );
    };

  // =====================================
  // SHARE
  // =====================================

  const copyRoomCode =
    async () => {
      if (!roomCode)
        return;

      await navigator.clipboard.writeText(
        roomCode
      );

      alert(
        "Room code copied!"
      );
    };

  const copyRoomLink =
    async () => {
      if (!roomCode)
        return;

      const link =
        `${window.location.origin}/?room=${roomCode}`;

      await navigator.clipboard.writeText(
        link
      );

      alert(
        "Room link copied!"
      );
    };

  // =====================================
  // NEW GAME
  // =====================================

  const startNewGame =
    () => {
      setGameId(null);

      setPlayers([]);

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

      setRoomCode("");

      setJoinCode("");

      setNumberOfPlayers(
        4
      );

      setBuyIn(500);

      router.push("/");
    };

  // =====================================
  // LOADING
  // =====================================

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#061a12] text-white">
        <p className="text-gray-400">
          Loading Poker Manager...
        </p>
      </main>
    );
  }

  // =====================================
  // UI
  // =====================================

  return (
    <main className="min-h-screen bg-[#061a12] text-white">

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-5 sm:py-8">

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
              <div className="mt-3 flex flex-wrap gap-3">

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
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold hover:bg-white/10"
            >
              Analytics
            </Link>

            <Link
              href="/history"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold hover:bg-white/10"
            >
              History
            </Link>

            <Link
              href="/dashboard"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold hover:bg-white/10"
            >
              Dashboard
            </Link>

          </div>

        </header>

        {/* ================================= */}
        {/* CREATE / JOIN */}
        {/* ================================= */}

        {!gameStarted && (
          <>

            {/* JOIN */}

            <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5 sm:p-6">

              <p className="text-sm uppercase tracking-[0.25em] text-emerald-400">
                Multiplayer
              </p>

              <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                Join Live Game
              </h2>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">

                <input
                  value={joinCode}
                  maxLength={6}
                  onChange={(e) =>
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
                  className="flex-1 rounded-xl border border-white/10 bg-black/20 px-5 py-4 font-black tracking-[0.25em] outline-none"
                />

                <button
                  onClick={joinGame}
                  disabled={joining}
                  className="rounded-xl bg-emerald-500 px-8 py-4 font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {joining
                    ? "Joining..."
                    : "Join Game"}
                </button>

              </div>

            </section>

            {/* CREATE GAME */}

            <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">

              <h2 className="text-2xl font-black sm:text-3xl">
                Create New Game
              </h2>

              <div className="mt-6 grid gap-5 md:grid-cols-2">

                <div>

                  <p className="mb-2 text-sm text-gray-400">
                    Players
                  </p>

                  <input
                    type="number"
                    min={2}
                    max={30}
                    value={
                      numberOfPlayers
                    }
                    onChange={(e) =>
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

                  <p className="mb-2 text-sm text-gray-400">
                    Buy-In
                  </p>

                  <input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={buyIn}
                    onChange={(e) =>
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

            {/* PLAYER NAMES */}

            {players.length >
              0 && (
              <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">

                <h2 className="text-2xl font-black">
                  Player Names
                </h2>

                <div className="mt-5 grid gap-4 md:grid-cols-2">

                  {players.map(
                    (
                      player
                    ) => (
                      <input
                        key={
                          player.id
                        }
                        value={
                          player.name
                        }
                        placeholder={`Player ${player.id}`}
                        onChange={(e) =>
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
                  className="mt-6 w-full rounded-xl bg-emerald-500 px-6 py-4 text-lg font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
                >

                  {saving
                    ? "Starting..."
                    : "Start Game ♠"}

                </button>

              </section>
            )}

          </>
        )}

        {/* ================================= */}
        {/* GAME */}
        {/* ================================= */}

        {gameStarted && (
          <>

            {/* ROOM */}

            {roomCode &&
              !gameFinished && (
              <section className="mb-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5 sm:p-6">

                <p className="text-sm uppercase tracking-[0.25em] text-emerald-400">
                  Live Room
                </p>

                <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

                  <p className="break-all text-3xl font-black tracking-[0.2em] sm:text-4xl">
                    {roomCode}
                  </p>

                  <div className="flex flex-wrap gap-3">

                    <button
                      onClick={
                        copyRoomCode
                      }
                      className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-bold"
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

            {/* VIEWER NOTICE */}

            {isGuest && (
              <div className="mb-8 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5 text-blue-300">
                Viewer Mode — changes made by the host appear here live.
              </div>
            )}

            {/* STATS */}

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

              <Stat
                title="Players"
                value={
                  players.length.toString()
                }
              />

              <Stat
                title="Active"
                value={
                  activePlayersCount.toString()
                }
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

            <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <h2 className="text-2xl font-black sm:text-3xl">
                  Players
                </h2>

                {!gameFinished &&
                  isHost && (
                  <button
                    onClick={
                      addPlayerMidGame
                    }
                    className="rounded-xl bg-emerald-500 px-4 py-3 font-black text-black"
                  >
                    + Player
                  </button>
                )}

              </div>

              <div className="mt-6 space-y-4">

                {players.map(
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

                    const profitPaise =
                      toPaise(
                        player.cashOut
                      ) -
                      investedPaise;

                    const profit =
                      toRupees(
                        profitPaise
                      );

                    return (
                      <div
                        key={
                          player.dbId ||
                          player.id
                        }
                        className={`rounded-2xl border p-4 sm:p-5 ${
                          player.active
                            ? "border-white/10 bg-black/20"
                            : "border-yellow-500/20 bg-yellow-500/5"
                        }`}
                      >

                        <div className="grid gap-5 lg:grid-cols-5 lg:items-center">

                          {/* PLAYER */}

                          <div>

                            <p className="mb-2 text-xs uppercase tracking-wider text-gray-500">
                              Player
                            </p>

                            <input
                              value={
                                player.name
                              }
                              disabled={
                                !isHost ||
                                gameFinished
                              }
                              onChange={(e) =>
                                updateName(
                                  player.id,
                                  e.target.value
                                )
                              }
                              onBlur={() =>
                                savePlayerName(
                                  player
                                )
                              }
                              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 font-bold disabled:border-transparent disabled:bg-transparent"
                            />

                            <p className="mt-2 text-xs text-gray-500">
                              Invested{" "}
                              {formatMoney(
                                invested
                              )}
                            </p>

                          </div>

                          {/* REBUYS */}

                          <div>

                            <p className="text-xs text-gray-500">
                              REBUYS
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
                                className="h-10 w-10 rounded-lg bg-white/5 font-bold disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                -
                              </button>

                              <b className="min-w-6 text-center text-lg">
                                {
                                  player.rebuys
                                }
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
                                className="h-10 w-10 rounded-lg bg-emerald-500 font-black text-black disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                +
                              </button>

                            </div>

                          </div>

                          {/* CASH OUT */}

                          <div>

                            <p className="text-xs text-gray-500">
                              CASH OUT
                            </p>

                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={
                                player.cashOutEntered
                                  ? player.cashOut
                                  : ""
                              }
                              placeholder="Enter amount"
                              disabled={
                                !isHost ||
                                gameFinished ||
                                !player.active
                              }
                              onChange={(e) => {
                                const value =
                                  e.target.value;

                                if (
                                  value ===
                                  ""
                                ) {
                                  clearCashOut(
                                    player.id
                                  );

                                  return;
                                }

                                updateCashOut(
                                  player.id,
                                  Number(
                                    value
                                  )
                                );
                              }}
                              onBlur={() => {
                                const latestPlayer =
                                  players.find(
                                    (
                                      item
                                    ) =>
                                      item.id ===
                                      player.id
                                  );

                                if (
                                  latestPlayer
                                ) {
                                  saveCashOut(
                                    latestPlayer
                                  );
                                }
                              }}
                              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 disabled:cursor-not-allowed disabled:opacity-50"
                            />

                            {player.cashOutEntered ? (
                              <p className="mt-1 text-xs font-medium text-emerald-400">
                                ✓ Cash-out entered
                              </p>
                            ) : (
                              <p className="mt-1 text-xs font-medium text-yellow-400">
                                Not entered
                              </p>
                            )}

                          </div>

                          {/* P/L */}

                          <div>

                            <p className="text-xs text-gray-500">
                              CURRENT P/L
                            </p>

                            <div className="mt-2 text-lg">

                              {player.cashOutEntered ? (
                                <Money
                                  value={
                                    profit
                                  }
                                />
                              ) : (
                                <span className="font-bold text-gray-500">
                                  —
                                </span>
                              )}

                            </div>

                          </div>

                          {/* STATUS */}

                          <div>

                            {player.active ? (
                              <button
                                disabled={
                                  !isHost ||
                                  gameFinished
                                }
                                onClick={() =>
                                  markPlayerLeft(
                                    player.id
                                  )
                                }
                                className="rounded-lg bg-yellow-500/10 px-4 py-2 font-bold text-yellow-400 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                Player Left
                              </button>
                            ) : (
                              <div className="flex flex-col items-start gap-2">

                                <span className="rounded-lg bg-yellow-500/10 px-4 py-2 text-sm font-bold text-yellow-400">
                                  Left Table
                                </span>

                                <button
                                  disabled={
                                    !isHost ||
                                    gameFinished
                                  }
                                  onClick={() =>
                                    reopenPlayer(
                                      player.id
                                    )
                                  }
                                  className="rounded-lg bg-emerald-500/10 px-4 py-2 font-bold text-emerald-400 disabled:cursor-not-allowed disabled:opacity-30"
                                >
                                  Reopen
                                </button>

                              </div>
                            )}

                          </div>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>

              {!gameFinished &&
                isHost && (
                <button
                  onClick={
                    finishGame
                  }
                  disabled={
                    saving
                  }
                  className="mt-8 w-full rounded-xl bg-emerald-500 px-6 py-4 text-lg font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Finishing Game..."
                    : "Finish Game"}
                </button>
              )}

            </section>

            {/* ================================= */}
            {/* FINAL RESULTS */}
            {/* ================================= */}

            {gameFinished && (
              <section className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">

                <p className="text-sm uppercase tracking-[0.25em] text-emerald-400">
                  Game Complete
                </p>

                <h2 className="mt-2 text-2xl font-black sm:text-3xl">
                  Final Settlement
                </h2>

                {/* DIFFERENCE */}

                {differencePaise !==
                  0 && (
                  <div className="mt-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-5">

                    <p className="font-bold text-yellow-300">
                      Equal Adjustment Applied
                    </p>

                    <p className="mt-2 text-gray-300">
                      The table difference was{" "}
                      <strong>
                        {formatMoney(
                          Math.abs(
                            difference
                          )
                        )}
                      </strong>
                      .
                    </p>

                    <p className="mt-2 text-sm text-gray-400">
                      The difference was distributed as equally as possible across all players down to the nearest paise.
                    </p>

                    <p className="mt-3">

                      Approximate adjustment per player:{" "}

                      <Money
                        value={
                          adjustmentPerPlayer
                        }
                      />

                    </p>

                  </div>
                )}

                {/* PAYMENT TRACKER */}

                <div className="mt-8">

                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

                    <div>

                      <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">
                        Payment Tracker
                      </p>

                      <h3 className="mt-1 text-2xl font-black">
                        Who Pays Whom
                      </h3>

                    </div>

                    {savedSettlements.length >
                      0 && (
                      <div className="flex flex-wrap gap-2">

                        <span className="rounded-full bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-400">
                          {
                            paidSettlementCount
                          }{" "}
                          Paid
                        </span>

                        <span className="rounded-full bg-yellow-500/10 px-3 py-2 text-sm font-bold text-yellow-400">
                          {
                            pendingSettlementCount
                          }{" "}
                          Pending
                        </span>

                      </div>
                    )}

                  </div>

                  {/* PAYMENT SUMMARY */}

                  {savedSettlements.length >
                    0 && (
                    <div className="mt-5 grid gap-4 sm:grid-cols-3">

                      <MiniStat
                        title="Total Settlement"
                        value={formatMoney(
                          totalSettlementAmount
                        )}
                      />

                      <MiniStat
                        title="Paid"
                        value={formatMoney(
                          paidSettlementAmount
                        )}
                      />

                      <MiniStat
                        title="Remaining"
                        value={formatMoney(
                          remainingSettlementAmount
                        )}
                      />

                    </div>
                  )}

                  {/* SETTLEMENTS */}

                  {savedSettlements.length >
                  0 ? (
                    <div className="mt-5 space-y-4">

                      {savedSettlements.map(
                        (
                          settlement
                        ) => (
                          <div
                            key={
                              settlement.id
                            }
                            className={`rounded-2xl border p-5 ${
                              settlement.status ===
                              "paid"
                                ? "border-emerald-500/20 bg-emerald-500/5"
                                : "border-yellow-500/20 bg-yellow-500/5"
                            }`}
                          >

                            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                              <div>

                                <div className="flex flex-wrap items-center gap-3">

                                  <span className="font-black text-red-400">
                                    {
                                      settlement.payer_name
                                    }
                                  </span>

                                  <span className="text-gray-500">
                                    →
                                  </span>

                                  <span className="font-black text-emerald-400">
                                    {
                                      settlement.receiver_name
                                    }
                                  </span>

                                </div>

                                <p className="mt-2 text-2xl font-black">
                                  {formatMoney(
                                    settlement.amount
                                  )}
                                </p>

                                {settlement.status ===
                                  "paid" &&
                                  settlement.paid_at && (
                                    <p className="mt-2 text-xs text-gray-500">
                                      Paid{" "}
                                      {new Date(
                                        settlement.paid_at
                                      ).toLocaleString(
                                        "en-IN"
                                      )}
                                    </p>
                                  )}

                              </div>

                              {settlement.status ===
                              "paid" ? (
                                <div className="flex flex-wrap gap-3">

                                  <span className="rounded-xl bg-emerald-500/10 px-4 py-3 font-black text-emerald-400">
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
                                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-bold"
                                    >
                                      Undo
                                    </button>
                                  )}

                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-3">

                                  <span className="rounded-xl bg-yellow-500/10 px-4 py-3 font-bold text-yellow-400">
                                    Pending
                                  </span>

                                  {isHost && (
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
                                  )}

                                </div>
                              )}

                            </div>

                          </div>
                        )
                      )}

                    </div>
                  ) : calculatedSettlements.length >
                    0 ? (
                    <div className="mt-5 space-y-3">

                      {calculatedSettlements.map(
                        (
                          settlement,
                          index
                        ) => (
                          <div
                            key={
                              `${settlement.from}-${settlement.to}-${index}`
                            }
                            className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/20 p-5 sm:flex-row sm:items-center sm:justify-between"
                          >

                            <span>

                              <b className="text-red-400">
                                {
                                  settlement.from
                                }
                              </b>

                              {" → "}

                              <b className="text-emerald-400">
                                {
                                  settlement.to
                                }
                              </b>

                            </span>

                            <b>
                              {formatMoney(
                                settlement.amount
                              )}
                            </b>

                          </div>
                        )
                      )}

                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-emerald-300">
                      ✓ No payments required.
                    </div>
                  )}

                </div>

                {/* ================================= */}
                {/* FINAL PLAYER RESULTS */}
                {/* ================================= */}

                <div className="mt-10 overflow-x-auto rounded-2xl border border-white/10">

                  <div className="min-w-[850px]">

                    <div className="grid grid-cols-6 bg-black/20 px-5 py-4 text-xs uppercase text-gray-500">

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
                            player.dbId ||
                            player.id
                          }
                          className="grid grid-cols-6 items-center border-t border-white/10 px-5 py-4"
                        >

                          <b>
                            {
                              player.name
                            }
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

                {/* FINAL BALANCE */}

                <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">

                  <p className="text-sm text-gray-500">
                    Final Balance
                  </p>

                  <div className="mt-2 text-2xl">

                    <Money
                      value={
                        finalBalance
                      }
                    />

                  </div>

                  {finalBalancePaise ===
                    0 && (
                    <p className="mt-2 text-sm font-semibold text-emerald-400">
                      ✓ Table balances exactly
                    </p>
                  )}

                </div>

                {/* ACTIONS */}

                {isHost && (
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">

                    <button
                      onClick={
                        editGame
                      }
                      className="rounded-xl border border-white/10 bg-white/5 px-6 py-4 font-bold hover:bg-white/10"
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

// =====================================
// FORMAT MONEY
// =====================================

function formatMoney(
  value: number
) {
  return `₹${value.toLocaleString(
    "en-IN",
    {
      minimumFractionDigits:
        Number.isInteger(
          value
        )
          ? 0
          : 2,

      maximumFractionDigits:
        2,
    }
  )}`;
}

// =====================================
// STAT CARD
// =====================================

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
            : ""
        }`}
      >
        {value}
      </p>

    </div>
  );
}

// =====================================
// MINI STAT
// =====================================

function MiniStat({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-4">

      <p className="text-xs uppercase tracking-wider text-gray-500">
        {title}
      </p>

      <p className="mt-1 text-lg font-black">
        {value}
      </p>

    </div>
  );
}

// =====================================
// MONEY DISPLAY
// =====================================

function Money({
  value,
}: {
  value: number;
}) {
  const valuePaise =
    toPaise(value);

  const cleanValue =
    toRupees(
      valuePaise
    );

  return (
    <span
      className={`font-black ${
        valuePaise >
        0
          ? "text-emerald-400"
          : valuePaise <
            0
          ? "text-red-400"
          : "text-gray-400"
      }`}
    >

      {valuePaise > 0
        ? "+"
        : ""}

      {formatMoney(
        cleanValue
      )}

    </span>
  );
}