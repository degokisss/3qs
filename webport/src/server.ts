// Milestone 3.5/3.6/3.9: WebSocket server with a human-controllable seat. Milestone 4: multi-room
// lobby -- a connecting client starts in the "lobby" (no room), sees a live list of open rooms,
// and either creates a new one (choosing 5-10 players) or joins an existing one. A newly created
// room sits idle (`started: false`, no turn loop scheduled) as a pure seat-picker until its
// creator sends `startGame`; only then does the room's `Room` simulation actually start running
// (any seat not claimed by then stays bot-controlled). Once started, the room broadcasts a JSON
// state snapshot to every client currently watching it after each turn. Any client watching a
// room can "claim" a seat; once claimed, that seat's decisions (Slash target, whether to equip,
// whether to play a trick, whether to dodge with Jink, whether to self-rescue with Peach,
// whether to use a proactive general self-action like Kurou) are asked of the claiming client
// over the same socket, with a timeout falling back to a policy documented per-ask below -- see
// controller.ts for what's still NOT covered (manual card/target selection for tricks, Duel's
// forced-Slash exchange). A room with no clients left watching it is torn down (its turn loop
// stopped, state discarded) -- see `leaveRoom` below.

import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Room } from "./room.js";
import { GameMode } from "./types.js";
import { Controller, pickLeastImportantCards } from "./controller.js";
import { SKILLS } from "./skill.js";
import { CARD_CATALOG, GENERAL_CATALOG } from "./library.js";
import type { Card } from "./card.js";

const PORT = Number(process.env.PORT ?? 8787);
const MIN_PLAYERS = 5; // Room's role table (Identity mode) and Hegemony's kingdom-quota math both start at 5.
const MAX_PLAYERS_IDENTITY = 10; // Room/gamerule.ts's role table only covers 5-10 players.
const MAX_PLAYERS_HEGEMONY = 12; // Hegemony has no role table -- kingdom quotas scale with player count.
const TURN_INTERVAL_MS = 500;
const HUMAN_RESPONSE_TIMEOUT_MS = 15000;

// Deployment note: serving the client (public/index.html) and the original QSanguosha image/
// font assets it references from THIS same process/port (instead of a separate static host)
// means a real deployment only ever needs to expose ONE port for both the page and the
// WebSocket API -- see webport/README.md's "Deploy" section.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, "../public");
const REPO_ROOT = path.resolve(__dirname, "../.."); // src/ -> webport/ -> repo root (image/, font/)
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".ttc": "font/collection",
  ".ico": "image/x-icon",
  ".ogg": "audio/ogg",
};

/** Resolves an incoming HTTP GET to a file on disk, or null for anything not explicitly
 *  whitelisted below (no directory listing, no serving arbitrary repo files). */
async function serveStatic(url: string): Promise<{ body: Buffer; contentType: string } | null> {
  const clean = decodeURIComponent(url.split("?")[0] ?? "/");
  let filePath: string;
  if (clean === "/" || clean === "/index.html") {
    filePath = path.join(PUBLIC_DIR, "index.html");
  } else if (clean.startsWith("/image/") || clean.startsWith("/font/")) {
    filePath = path.join(REPO_ROOT, clean);
    if (!filePath.startsWith(REPO_ROOT + path.sep)) return null; // no escaping above the repo root
  } else if (clean.startsWith("/audio/")) {
    // Combat hit sound effects -- a small handful of files restored from git history (the
    // original audio/ directory was stripped from the repo entirely; see the commit that did
    // it) into webport/public/audio/, NOT the repo-root pattern above (that original directory
    // no longer exists on disk at all, only the specific files this client actually plays do).
    filePath = path.join(PUBLIC_DIR, clean);
    if (!filePath.startsWith(PUBLIC_DIR + path.sep)) return null; // no escaping above public/
  } else {
    return null;
  }
  try {
    const body = await readFile(filePath);
    return { body, contentType: MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

function newPlayerIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `P${i + 1}`);
}

interface GameRoom {
  readonly id: string;
  room: Room;
  readonly clients: Set<WebSocket>;
  // playerId -> the ws that claimed it (absent = bot-controlled or empty, see botEnabledSlots).
  readonly claimedSeats: Map<string, WebSocket>;
  // Which unclaimed slots the creator has toggled to "bot" -- everything else stays empty and
  // is excluded entirely once the room actually starts (see "startGame"). Mutually exclusive
  // with claimedSeats: claiming a slot always clears its bot flag ("claim"), and a slot can't
  // be bot-toggled while claimed ("toggleBot").
  readonly botEnabledSlots: Set<string>;
  readonly pendingRequests: Map<string, (msg: Record<string, unknown>) => void>;
  nextRequestId: number;
  loopTimer: NodeJS.Timeout | null;
  /** True once the creator has explicitly started the game -- before that, `loopTimer` is never
   *  scheduled, so no bot (or claimed-seat) turns run at all; the room just sits as a seat-picker. */
  started: boolean;
  /** The socket that created this room -- the only one allowed to send `startGame`/`toggleBot`.
   *  Promoted to another remaining watcher if the creator leaves before starting (see `leaveRoom`). */
  creatorWs: WebSocket;
  /** Fixed at room creation (see "createRoom") -- which of the two Room modes this room plays.
   *  Never changes for the lifetime of a room (a mode switch would need a whole new room). */
  mode: GameMode;
}

const rooms = new Map<string, GameRoom>();
// Which room (if any) each connected socket is currently watching -- a socket is either "in the
// lobby" (absent from this map, sees the live room list) or watching exactly one room.
const wsRoom = new Map<WebSocket, GameRoom>();
// Optional display name a connected socket set via "setName", shown alongside the P1..P10 seat
// id it claims (if any) so players can actually tell each other apart -- keyed by socket, not
// room, so it survives a "leaveRoom"/rejoin and doesn't need re-entering per room. Cleared on
// disconnect (see "close" below) to avoid an unbounded leak across reconnects.
const displayNames = new Map<WebSocket, string>();
const MAX_NAME_LENGTH = 24;

// Room codes: 4 chars, excludes visually-ambiguous 0/O/1/I so they're easy to read/say aloud.
const ROOM_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRoomId(): string {
  let id: string;
  do {
    id = Array.from({ length: 4 }, () => ROOM_ID_ALPHABET[Math.floor(Math.random() * ROOM_ID_ALPHABET.length)]).join("");
  } while (rooms.has(id));
  return id;
}

function scheduleLoop(gr: GameRoom, room: Room): void {
  gr.loopTimer = setTimeout(async () => {
    // Stop entirely (do NOT reschedule) once this loop's room is no longer the room the game
    // room is actually pointing at -- e.g. "new" reset gr.room to a fresh, ungenerated Room
    // while `await room.playTurn()` below was still in flight on the OLD room. Without this
    // check the unconditional `scheduleLoop(gr, room)` at the bottom would keep re-arming
    // itself against whatever `gr.room` becomes, eventually calling playTurn() on a room that
    // never went through pickGenerals() and crashing the whole process.
    if (!rooms.has(gr.id) || gr.room !== room) return;
    if (!room.gameOver) {
      await room.playTurn();
      broadcast(gr);
      broadcastLobby(); // the room's turnNumber/gameOver summary changed
    }
    scheduleLoop(gr, room);
  }, TURN_INTERVAL_MS);
}

/** Always creates a room with the mode's full display-slot count (P1-P10 for Identity, P1-P12
 *  for Hegemony) -- the creator decides, before starting, which ones actually play: claim a
 *  seat themselves, let others claim seats, and toggle bots onto whichever remaining slots they
 *  want filled (see "toggleBot"/"startGame"). Anything left neither claimed nor bot-toggled is
 *  simply excluded from the real Room `startGame` builds, not silently defaulted to a bot like
 *  before. `mode` is fixed for the room's whole lifetime (see the GameRoom field doc comment) --
 *  the placeholder Room built here is already constructed with it (its role/kingdom assignments
 *  are thrown away at `startGame` anyway; only the seat slots it provides for the pre-start
 *  picker matter), since Room's own constructor validates player count PER mode. */
function createRoom(creatorWs: WebSocket, mode: GameMode): GameRoom {
  const gr: GameRoom = {
    id: generateRoomId(),
    room: new Room(newPlayerIds(mode === GameMode.Hegemony ? MAX_PLAYERS_HEGEMONY : MAX_PLAYERS_IDENTITY), undefined, mode),
    clients: new Set(),
    claimedSeats: new Map(),
    botEnabledSlots: new Set(),
    pendingRequests: new Map(),
    nextRequestId: 1,
    loopTimer: null,
    started: false,
    creatorWs,
    mode,
  };
  rooms.set(gr.id, gr);
  // Weapon/Horse equips otherwise wouldn't show up for any watching client until the whole turn
  // finished (broadcast() only fires once per COMPLETED turn) -- this makes them show immediately.
  gr.room.setLiveUpdateCallback(() => broadcast(gr));
  gr.room.setPrivateRevealCallback((viewerId, reveal) => notifyClient(gr, viewerId, { type: "privateReveal", reveal }));
  // No scheduleLoop() here -- the room sits idle (no bot/human turns run) until the creator
  // sends `startGame`, so players can freely claim seats before anything happens.
  return gr;
}

function destroyRoom(gr: GameRoom): void {
  clearTimeout(gr.loopTimer ?? undefined);
  rooms.delete(gr.id);
}

function roomSummary(gr: GameRoom) {
  return {
    id: gr.id,
    mode: gr.mode,
    seatsClaimed: gr.claimedSeats.size,
    botCount: gr.botEnabledSlots.size,
    watchers: gr.clients.size,
    turnNumber: gr.room.turnNumber,
    gameOver: !!gr.room.gameOver,
    started: gr.started,
    // Mirrors the per-room `pickingGenerals` flag (see the personalized room-state builder
    // below): true once `startGame` fired but before every seat has a general, so the lobby
    // list can show "Đang chọn tướng" distinctly from "Đang chơi" / "Đang chờ".
    pickingGenerals: gr.started && gr.room.players.some((p) => !p.general),
  };
}

function roomListPayload() {
  return { type: "roomList", rooms: [...rooms.values()].map(roomSummary) };
}

function broadcastLobby(): void {
  const data = JSON.stringify(roomListPayload());
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN && !wsRoom.has(ws)) ws.send(data);
  }
}

/**
 * Sends `payload` (plus a generated requestId/timeoutMs) to the client holding `playerId`'s
 * seat in room `gr`, and resolves with `interpret(responseMsg)` once it answers -- or with
 * `fallback` if no one is connected to that seat, or if `timeoutMs` elapses with no answer.
 */
function askClient<T>(
  gr: GameRoom,
  playerId: string,
  payload: Record<string, unknown>,
  interpret: (msg: Record<string, unknown>) => T,
  fallback: T,
  timeoutMs = HUMAN_RESPONSE_TIMEOUT_MS,
): Promise<T> {
  const { promise, resolve } = Promise.withResolvers<T>();
  const ws = gr.claimedSeats.get(playerId);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    resolve(fallback);
    return promise;
  }
  const requestId = String(gr.nextRequestId++);
  const timeout = setTimeout(() => {
    gr.pendingRequests.delete(requestId);
    resolve(fallback);
  }, timeoutMs);
  gr.pendingRequests.set(requestId, (msg) => {
    clearTimeout(timeout);
    resolve(interpret(msg));
  });
  ws.send(JSON.stringify({ ...payload, requestId, timeoutMs }));
  return promise;
}

/** One-way notification to whichever client currently holds `playerId`'s seat -- unlike
 *  `askClient`, no response is expected, so there's no requestId/timeout. A no-op if nobody is
 *  connected to that seat (same silent-no-op-for-an-unclaimed-seat behavior `askClient` falls
 *  back to via its own `fallback` param). Used for KnownBoth's private reveal. */
function notifyClient(gr: GameRoom, playerId: string, payload: Record<string, unknown>): void {
  const ws = gr.claimedSeats.get(playerId);
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function equipCardName(card: Card): string {
  return card.weaponName ?? card.horseName ?? card.armorName ?? card.kind;
}

/**
 * Fallback policy on timeout/disconnect for each ask: offensive/optional-resource actions
 * (Slash target, trick usage) default to NOT happening (a silent human is assumed to be passing,
 * matching Milestone 3.5's original chooseSlashTarget behavior); protective/self-preserving
 * actions (equip, dodge, self-heal) default to happening, since declining protection with no
 * response would be actively harmful rather than a sensible "did nothing" default.
 */
function makeHumanController(gr: GameRoom, playerId: string): Partial<Controller> {
  return {
    chooseSlashTarget: (_actor, candidates) =>
      askClient(
        gr,
        playerId,
        { type: "chooseSlashTarget", actorId: playerId, candidateIds: candidates.map((c) => c.id) },
        (msg) => candidates.find((c) => c.id === msg.targetId) ?? null,
        null,
      ),
    chooseTrickTarget: (_player, kind, candidates) =>
      askClient(
        gr,
        playerId,
        { type: "chooseTrickTarget", actorId: playerId, kind, candidateIds: candidates.map((c) => c.id) },
        (msg) => candidates.find((c) => c.id === msg.targetId) ?? null,
        null,
      ),
    wantsToEquip: (_player, card) =>
      askClient(
        gr,
        playerId,
        { type: "confirmEquip", actorId: playerId, cardKind: card.kind, cardName: equipCardName(card) },
        (msg) => msg.value !== false,
        true,
      ),
    wantsToPlayTrick: (_player, kind) =>
      askClient(gr, playerId, { type: "confirmTrick", actorId: playerId, kind }, (msg) => msg.value === true, false),
    wantsToDodge: () =>
      askClient(gr, playerId, { type: "confirmDodge", actorId: playerId }, (msg) => msg.value !== false, true),
    wantsToUsePeach: () =>
      askClient(gr, playerId, { type: "confirmPeach", actorId: playerId }, (msg) => msg.value !== false, true),
    wantsToUsePeachForOther: (_rescuer, dyingPlayer) =>
      askClient(
        gr,
        playerId,
        { type: "confirmPeachForOther", actorId: playerId, dyingPlayerId: dyingPlayer.id },
        (msg) => msg.value === true,
        false, // fallback on timeout/disconnect: matches the bot default -- ally rescue spends
        // MY resource to help someone else, so a silent human is assumed to decline, same
        // "offensive/optional-resource action" policy as wantsToPlayTrick above
      ),
    wantsToPlaySlashInDuel: () =>
      askClient(gr, playerId, { type: "confirmDuelSlash", actorId: playerId }, (msg) => msg.value !== false, true),
    wantsToDiscardForGanglie: () =>
      askClient(gr, playerId, { type: "confirmGanglieDiscard", actorId: playerId }, (msg) => msg.value !== false, true),
    wantsToDiscardForSavageAssault: () =>
      askClient(gr, playerId, { type: "confirmSavageAssaultSlash", actorId: playerId }, (msg) => msg.value !== false, true),
    wantsToDiscardForArcheryAttack: () =>
      askClient(gr, playerId, { type: "confirmArcheryAttackJink", actorId: playerId }, (msg) => msg.value !== false, true),
    wantsToUseKylinBow: () =>
      askClient(
        gr,
        playerId,
        { type: "confirmKylinBow", actorId: playerId },
        (msg) => msg.value === true,
        false, // fallback on timeout/disconnect: offensive/optional-resource action (destroying
        // someone else's horse), same "silent human passes" policy as wantsToPlayTrick above
      ),
    wantsToUseIceSword: () =>
      askClient(
        gr,
        playerId,
        { type: "confirmIceSword", actorId: playerId },
        (msg) => msg.value === true,
        false, // fallback: offensive/optional-resource action, same policy as wantsToUseKylinBow
      ),
    wantsToUseAxe: () =>
      askClient(
        gr,
        playerId,
        { type: "confirmAxe", actorId: playerId },
        (msg) => msg.value === true,
        false, // fallback: offensive/optional-resource action, same policy as wantsToUseKylinBow
      ),
    wantsToUseEightDiagram: () =>
      askClient(
        gr,
        playerId,
        { type: "confirmEightDiagram", actorId: playerId },
        (msg) => msg.value !== false,
        true, // fallback on timeout/disconnect: unlike Axe/IceSword/KylinBow (which spend a
        // resource against SOMEONE ELSE), this ask only risks a wasted judgment card of your
        // OWN in exchange for a free shot at avoiding certain damage -- matches
        // wantsToDodge/wantsToUsePeach's "protective, always assumed yes" policy instead
      ),
    wantsToUseDoubleSword: () =>
      askClient(
        gr,
        playerId,
        { type: "confirmDoubleSword", actorId: playerId },
        (msg) => msg.value === true,
        false, // fallback: offensive/optional-resource action, same policy as wantsToUseKylinBow
      ),
    wantsToDiscardForDoubleSword: () =>
      askClient(
        gr,
        playerId,
        { type: "confirmDiscardDoubleSword", actorId: playerId },
        (msg) => msg.value !== false,
        true, // fallback: protective-ish (denies the wielder a card), same policy as
        // wantsToDiscardForGanglie/SavageAssault/ArcheryAttack
      ),
    wantsToUseSelfAction: (player, skillName) => {
      const skill = player.skills.find((s) => s.name === skillName);
      return askClient(
        gr,
        playerId,
        {
          type: "confirmSelfAction",
          actorId: playerId,
          skillName,
          skillDisplayName: skill?.displayName ?? skillName,
          skillDescription: skill?.description ?? "",
        },
        (msg) => msg.value !== false,
        true, // matches the bot default (a resource trade the greedy policy always takes)
      );
    },
    chooseGeneral: (candidates, role) =>
      askClient(
        gr,
        playerId,
        {
          type: "pickGeneral",
          actorId: playerId,
          role: role ?? null, // "main"/"deputy" (Hegemony only) or null (Identity's single pick)
          candidates: candidates.map((g) => ({
            name: g.name,
            displayName: g.displayName,
            kingdom: g.kingdom,
            maxHp: g.maxHp,
            skills: g.skillNames.map((n) => {
              const s = SKILLS[n];
              return { name: s.displayName, description: s.description };
            }),
          })),
        },
        (msg) => candidates.find((g) => g.name === msg.generalName) ?? candidates[0],
        candidates[0], // fallback on timeout/disconnect: auto-pick the first candidate so the game always proceeds
        30000, // longer than the other asks -- this is a deliberate one-time pick with skill text to read
      ),
    chooseReveal: (player, mainHidden, deputyHidden) =>
      askClient(
        gr,
        playerId,
        {
          type: "chooseReveal",
          actorId: playerId,
          mainHidden,
          deputyHidden,
          mainGeneralName: player.generalName,
          deputyGeneralName: player.deputyGeneralName,
        },
        (msg) => ({ main: msg.main === true, deputy: msg.deputy === true }),
        { main: false, deputy: false }, // fallback on timeout/disconnect: stay hidden -- a legitimate real choice, never forced
      ),
    chooseCompanionBonus: (player, canRecover) =>
      askClient(
        gr,
        playerId,
        {
          type: "chooseCompanionBonus",
          actorId: playerId,
          canRecover,
          mainGeneralName: player.generalName,
          deputyGeneralName: player.deputyGeneralName,
        },
        (msg) => (msg.choice === "recover" || msg.choice === "draw" ? msg.choice : "cancel"),
        canRecover ? "recover" : "draw", // fallback on timeout/disconnect: matches the bot default
      ),
    wantsHalfMaxHpBonusDraw: (player) =>
      askClient(
        gr,
        playerId,
        { type: "confirmHalfMaxHpDraw", actorId: playerId },
        (msg) => msg.value !== false,
        true, // fallback on timeout/disconnect: matches the bot default (always accept)
      ),
    chooseDiscards: (player, count) =>
      askClient(
        gr,
        playerId,
        { type: "chooseDiscards", actorId: playerId, count, hand: player.hand },
        (msg) => {
          const ids = Array.isArray(msg.cardIds) ? msg.cardIds : [];
          return player.hand.filter((c) => ids.includes(c.id));
        },
        pickLeastImportantCards(player.hand, count), // fallback on timeout/disconnect: discard the least valuable cards, not an arbitrary first-N
      ),
    chooseSpearCards: (player) =>
      askClient(
        gr,
        playerId,
        { type: "chooseSpearCards", actorId: playerId, hand: player.hand },
        (msg) => {
          const ids = Array.isArray(msg.cardIds) ? msg.cardIds : [];
          return player.hand.filter((c) => ids.includes(c.id));
        },
        [], // fallback on timeout/disconnect: an empty (invalid) response reads as "declined" --
        // never forced, matching wantsToPlayTrick's "silent human passes" policy, unlike
        // chooseDiscards which substitutes a real pick because that ask IS mandatory
      ),
    chooseGuanxingBottom: (_player, revealed) =>
      askClient(
        gr,
        playerId,
        { type: "chooseGuanxingBottom", actorId: playerId, revealed },
        (msg) => {
          const ids = Array.isArray(msg.bottomIds) ? msg.bottomIds : [];
          return new Set(revealed.filter((c) => ids.includes(c.id)).map((c) => c.id));
        },
        new Set<number>(), // fallback on timeout/disconnect: leave the pile untouched (nothing buried), matching
        // wantsToPlayTrick's "silent human passes" policy -- this ask is optional, never forced
      ),
    wantsToUseGuicai: (player, judgeOwner, currentCard, reason) =>
      askClient(
        gr,
        playerId,
        { type: "chooseGuicaiRetrial", actorId: playerId, judgeOwnerId: judgeOwner.id, currentCard, reason, hand: player.hand },
        (msg) => (msg.cardId == null ? null : (player.hand.find((c) => c.id === msg.cardId) ?? null)),
        null, // fallback on timeout/disconnect: decline, matching wantsToPlayTrick's "silent human passes" policy
      ),
    choosePickCard: (_player, candidates) =>
      askClient(
        gr,
        playerId,
        { type: "choosePickCard", actorId: playerId, cards: candidates },
        (msg) => candidates.find((c) => c.id === msg.cardId) ?? candidates[0],
        candidates[0], // fallback on timeout/disconnect: matches the bot's own default (first revealed card)
      ),
    choosePlayerCard: (player, owner, candidates) =>
      askClient(
        gr,
        playerId,
        {
          type: "choosePlayerCard",
          actorId: playerId,
          ownerId: owner.id,
          // Equipment is always public (full identity sent); a hand card's identity must NEVER
          // reach this socket ahead of the pick -- only its `id` (so the click can name which
          // slot was chosen) and `hidden: true` go over the wire, matching real Sanguosha's
          // "you don't know what you're taking from someone's hand" rule.
          cards: candidates.map((c) =>
            owner.hand.includes(c)
              ? { id: c.id, hidden: true }
              : {
                  id: c.id,
                  hidden: false,
                  kind: c.kind,
                  weaponName: c.weaponName ?? null,
                  horseName: c.horseName ?? null,
                  armorName: c.armorName ?? null,
                },
          ),
        },
        (msg) => candidates.find((c) => c.id === msg.cardId) ?? candidates[0],
        candidates[0], // fallback on timeout/disconnect: matches choosePickCard's own default
      ),
    wantsToDrawNow: (_player, count) =>
      askClient(
        gr,
        playerId,
        { type: "confirmDrawCard", actorId: playerId, count },
        () => undefined,
        undefined, // fallback on timeout/disconnect: auto-draw so the turn never stalls forever
      ),
    chooseFreeAction: (player, legalActions) =>
      askClient(
        gr,
        playerId,
        {
          type: "chooseFreeAction",
          actorId: playerId,
          hand: player.hand, // live hand as of right now -- broadcast() only fires once per
          // COMPLETED turn, so without this the client's displayed hand goes stale mid-turn
          // (this turn's Draw-phase cards, or a card already played earlier this same Play phase)
          legalActions: legalActions.map((a, actionId) => {
            if (a.kind === "selfAction" || a.kind === "activeAction") {
              const skill = player.skills.find((s) => s.name === a.skillName);
              return { ...a, actionId, skillDisplayName: skill?.displayName ?? a.skillName, skillDescription: skill?.description ?? "" };
            }
            return { ...a, actionId };
          }),
        },
        (msg) => {
          const idx = Number(msg.actionId);
          return Number.isInteger(idx) && idx >= 0 && idx < legalActions.length ? legalActions[idx] : null;
        },
        null, // no answer/timeout -> end the Play phase, same "silent human passes" policy as the other offensive/optional asks
      ),
    wantsToNullify: (_player, kind, source, target) =>
      askClient(
        gr,
        playerId,
        { type: "confirmNullification", actorId: playerId, kind, sourceId: source.id, targetId: target.id },
        (msg) => msg.value === true,
        false, // fallback on timeout/disconnect: spending a scarce answer card is an
        // offensive/optional-resource action, same "silent human passes" policy as wantsToPlayTrick
      ),
    chooseHegNullificationScope: (_player, target) =>
      askClient(
        gr,
        playerId,
        { type: "chooseHegNullificationScope", actorId: playerId, targetId: target.id },
        (msg) => (msg.scope === "all" ? "all" : "single"),
        "single", // fallback on timeout/disconnect: the narrower, non-forced scope -- never
        // silently escalated to the wider "all" option the player didn't actually choose
      ),
    chooseKnownBothOption: (_player, target, options) =>
      askClient(
        gr,
        playerId,
        { type: "chooseKnownBothOption", actorId: playerId, targetId: target.id, options },
        (msg) => (options.includes(msg.choice as (typeof options)[number]) ? (msg.choice as (typeof options)[number]) : options[0]),
        options[0], // fallback on timeout/disconnect: matches choosePickCard's own "first
        // available option" default
      ),
  };
}

function reapplyClaims(gr: GameRoom): void {
  for (const [playerId, ws] of gr.claimedSeats) {
    if (ws.readyState === WebSocket.OPEN && gr.room.players.some((p) => p.id === playerId)) {
      gr.room.setController(playerId, makeHumanController(gr, playerId));
    } else {
      gr.claimedSeats.delete(playerId);
    }
  }
}

function releaseSeatsHeldBy(gr: GameRoom, ws: WebSocket): void {
  for (const [playerId, holder] of gr.claimedSeats) {
    if (holder === ws) {
      gr.claimedSeats.delete(playerId);
      gr.room.setController(playerId, null);
    }
  }
}

function snapshot(gr: GameRoom) {
  return {
    type: "state",
    roomId: gr.id,
    mode: gr.mode,
    started: gr.started,
    // Milestone 6: true from `startGame` until every player has a general -- the client shows a
    // dedicated pick-a-general screen instead of the normal table while this holds.
    pickingGenerals: gr.started && gr.room.players.some((p) => !p.general),
    turnNumber: gr.room.turnNumber,
    aoChienActive: gr.room.aoChienActive,
    // Room's constructor sets currentIndex to the lord's seat the INSTANT it's created (well
    // before anyone picks generals or the creator starts the match) -- exposing it while the
    // room still sits in the lobby/waiting-room would leak who the lord is via the client's
    // "current player" gold highlight. Only reveal it once the match has actually started,
    // matching roleShown's own "public knowledge once the match begins" rule right below.
    currentPlayerId: gr.started ? gr.room.players[gr.room.currentIndex]?.id ?? null : null,
    gameOver: gr.room.gameOver,
    players: gr.room.players.map((p) => {
      // Hegemony fog-of-war: kingdom (and therefore faction/isAmbitionist/skills) becomes known
      // to OTHER clients the instant EITHER general reveals (real rule: they share one kingdom,
      // so either reveal exposes it); each general's own SPECIFIC identity stays gated by its
      // own `mainRevealed`/`deputyRevealed` flag independently. Identity mode is unaffected --
      // `kingdomKnown` is always true there, so every field below behaves exactly as before.
      const kingdomKnown = gr.mode !== GameMode.Hegemony || p.mainRevealed || p.deputyRevealed;
      return {
        id: p.id,
        general: gr.mode === GameMode.Hegemony && !p.mainRevealed ? null : p.general,
        generalName: gr.mode === GameMode.Hegemony && !p.mainRevealed ? null : p.generalName,
        deputyGeneral: gr.mode === GameMode.Hegemony && !p.deputyRevealed ? null : p.deputyGeneral,
        deputyGeneralName: gr.mode === GameMode.Hegemony && !p.deputyRevealed ? null : p.deputyGeneralName,
        mainRevealed: p.mainRevealed,
        deputyRevealed: p.deputyRevealed,
        kingdom: kingdomKnown ? p.kingdom : null,
        alive: p.alive,
        chained: p.chained,
        hp: p.hp,
        maxHp: p.maxHp,
        // Role is only revealed to spectators once the player has shown it in-game (dead, or lord
        // from the start) -- mirrors Player::hasShownRole, so this is a legitimate "fog of war" view
        // (personalize() below additionally reveals a claiming socket's OWN role once started).
        // Identity mode only -- Hegemony mode has no hidden role, it uses faction/isAmbitionist
        // below instead (both visible from the start, see gamerule.ts's Hegemony section header).
        role: gr.mode === GameMode.Identity ? (p.roleShown ? p.role : null) : null,
        faction: kingdomKnown ? p.faction : "",
        isAmbitionist: kingdomKnown ? p.isAmbitionist : false,
        handcardNum: p.handcardNum,
        weapon: p.weapon?.weaponName ?? null,
        weaponRange: p.weapon?.weaponRange ?? null,
        armor: p.armor?.armorName ?? null,
        defenseHorse: p.defenseHorse?.horseName ?? null,
        defenseHorseDelta: p.defenseHorse?.horseDelta ?? null,
        offenseHorse: p.offenseHorse?.horseName ?? null,
        offenseHorseDelta: p.offenseHorse?.horseDelta ?? null,
        claimed: gr.claimedSeats.has(p.id),
        // Whatever name the claiming socket set via "setName", if any -- null for bot/empty
        // seats or a claimed-but-nameless human (client falls back to showing just the P1..P10
        // id, exactly like before this feature existed).
        playerName: (() => {
          const holder = gr.claimedSeats.get(p.id);
          return holder ? (displayNames.get(holder) ?? null) : null;
        })(),
        botEnabled: gr.botEnabledSlots.has(p.id),
        // `p.skills` is itself reveal-gated now (see player.ts's getter) -- precisely only the
        // REVEALED general's skills, no separate kingdomKnown check needed here any more.
        skills: p.skills.map((s) => ({
          name: s.displayName,
          description: s.description,
          skillName: s.name, // internal key -- matches FreeAction's `skillName` so the client can
          // find the matching legalActions entry for a hero-panel skill button click
          isActive: !!(s.selfAction || s.activeAction), // Play-phase active skill (offered via
          // chooseFreeAction's legalActions) vs a purely passive/reactive one (auto-fires on its
          // own hook, e.g. onDamaged/onIncomingSlash -- no player choice, no button)
        })),
      };
    }),
    log: gr.room.log.slice(-40),
  };
}

/** The playerId whichever seat `ws` has claimed in `gr`, or null if it hasn't claimed one. */
function claimedPlayerIdFor(gr: GameRoom, ws: WebSocket): string | null {
  for (const [playerId, holder] of gr.claimedSeats) {
    if (holder === ws) return playerId;
  }
  return null;
}

/** The actual hand of whichever seat `ws` has claimed in `gr`, or null if it hasn't claimed one
 *  -- only the claiming client itself is ever shown these (every other client's snapshot still
 *  only sees `handcardNum`, matching the existing fog-of-war policy for opponents' hands). */
function myHandFor(gr: GameRoom, ws: WebSocket): Card[] | null {
  const playerId = claimedPlayerIdFor(gr, ws);
  return playerId ? gr.room.players.find((p) => p.id === playerId)?.hand ?? null : null;
}

/** Personalizes a shared snapshot for one socket: isCreator/myHand as before, plus -- once the
 *  match has started -- reveals the claiming socket's OWN role AND (Hegemony) own general/
 *  kingdom/faction/skills, regardless of `p.roleShown`/reveal state. Every player always knows
 *  their own identity in real Sanguosha; only OTHER players' stay fogged. */
function personalize(gr: GameRoom, ws: WebSocket, shared: ReturnType<typeof snapshot>) {
  const myPlayerId = claimedPlayerIdFor(gr, ws);
  const players =
    gr.started && myPlayerId
      ? shared.players.map((p) => {
          if (p.id !== myPlayerId) return p;
          const real = gr.room.players.find((rp) => rp.id === myPlayerId)!;
          return {
            ...p,
            role: real.role,
            general: real.general,
            generalName: real.generalName,
            deputyGeneral: real.deputyGeneral,
            deputyGeneralName: real.deputyGeneralName,
            kingdom: real.kingdom,
            faction: real.faction,
            isAmbitionist: real.isAmbitionist,
            // allSkills (not the reveal-gated `skills`): the owner always knows what they
            // drafted, even before choosing to reveal it to anyone else -- same "you always
            // know your own stuff" precedent as general/kingdom above. Whether a still-hidden
            // skill is actually USABLE is separately enforced by computeLegalActions (room.ts),
            // which reads the gated `skills` and simply never offers one that isn't active yet.
            skills: real.allSkills.map((s) => ({
              name: s.displayName,
              description: s.description,
              skillName: s.name,
              isActive: !!(s.selfAction || s.activeAction),
            })),
          };
        })
      : shared.players;
  return { ...shared, players, isCreator: ws === gr.creatorWs, myHand: myHandFor(gr, ws) };
}

function broadcast(gr: GameRoom): void {
  const shared = snapshot(gr);
  for (const ws of gr.clients) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(personalize(gr, ws, shared)));
    }
  }
}

function joinRoom(ws: WebSocket, gr: GameRoom): void {
  wsRoom.set(ws, gr);
  gr.clients.add(ws);
  ws.send(JSON.stringify(personalize(gr, ws, snapshot(gr))));
}


/** Leaves whatever room `ws` is currently watching (no-op if it's in the lobby): releases any
 *  seat it claimed, and tears the room down once nobody is watching it any more. */
function leaveRoom(ws: WebSocket): void {
  const gr = wsRoom.get(ws);
  if (!gr) return;
  wsRoom.delete(ws);
  releaseSeatsHeldBy(gr, ws);
  gr.clients.delete(ws);
  if (gr.clients.size === 0) {
    destroyRoom(gr);
  } else {
    // The creator left before starting: promote another remaining watcher so the room doesn't
    // get stuck forever with no one able to send `startGame`.
    if (gr.creatorWs === ws && !gr.started) {
      gr.creatorWs = gr.clients.values().next().value!;
    }
    broadcast(gr);
  }
  broadcastLobby();
}

const httpServer = createServer((req, res) => {
  serveStatic(req.url ?? "/")
    .then((file) => {
      if (!file) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
        return;
      }
      // The HTML shell changes on every deploy (client logic, tooltips, etc. all live inline in
      // it) -- caching it would leave already-connected browsers stuck on a stale build with no
      // way to revalidate (no ETag/Last-Modified support here). Only the true static assets
      // (original QSanguosha images/fonts, which never change post-release) get the long cache.
      const cacheControl = file.contentType.startsWith("text/html") ? "no-store" : "public, max-age=3600";
      res.writeHead(200, { "Content-Type": file.contentType, "Cache-Control": cacheControl }).end(file.body);
    })
    .catch(() => res.writeHead(500).end("Internal error"));
});

// WebSocket upgrades share the SAME http server/port as the static file serving above -- a
// deployment (reverse proxy, PaaS) only ever has to terminate/forward ONE public port.
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  ws.send(JSON.stringify(roomListPayload())); // every connection starts in the lobby

  ws.on("close", () => {
    leaveRoom(ws);
    displayNames.delete(ws);
  });

  ws.on("message", (raw) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    switch (msg.type) {
      case "listRooms":
        ws.send(JSON.stringify(roomListPayload()));
        break;
      case "listLibrary":
        // Static reference data (every ported general's skills + every card kind's rules text)
        // -- computed once at module load in library.ts, never changes at runtime, works from
        // the lobby or mid-game alike (no room/seat required).
        ws.send(JSON.stringify({ type: "library", generals: GENERAL_CATALOG, cards: CARD_CATALOG }));
        break;
      case "setName": {
        // Works from the lobby or mid-room, like "listLibrary" -- no room/seat required. Sets
        // (or clears, if blank after trimming) the name shown alongside whichever seat this
        // socket claims, in every room it's currently watching.
        const name = String(msg.name ?? "").trim().slice(0, MAX_NAME_LENGTH);
        if (name) displayNames.set(ws, name);
        else displayNames.delete(ws);
        const gr = wsRoom.get(ws);
        if (gr) broadcast(gr); // re-broadcast so every watcher's seat labels pick up the new name
        break;
      }
      case "createRoom": {
        leaveRoom(ws); // in case this socket was already watching another room
        const mode = msg.mode === "hegemony" ? GameMode.Hegemony : GameMode.Identity;
        const gr = createRoom(ws, mode);
        joinRoom(ws, gr);
        broadcastLobby();
        break;
      }
      case "joinRoom": {
        const gr = rooms.get(String(msg.roomId));
        if (!gr) {
          ws.send(JSON.stringify({ type: "error", message: "Phòng không tồn tại hoặc đã đóng." }));
          ws.send(JSON.stringify(roomListPayload()));
          return;
        }
        leaveRoom(ws);
        joinRoom(ws, gr);
        broadcastLobby();
        break;
      }
      case "leaveRoom":
        leaveRoom(ws); // already sends this socket a fresh roomList via its internal broadcastLobby()
        break;
      case "startGame": {
        const gr = wsRoom.get(ws);
        if (!gr || gr.started) return;
        if (gr.creatorWs !== ws) {
          ws.send(JSON.stringify({ type: "error", message: "Chỉ người tạo phòng mới có thể bắt đầu." }));
          return;
        }
        // Only slots the creator actually configured (claimed by someone, or toggled to bot)
        // play -- anything left neither claimed nor bot-toggled is simply excluded, not
        // defaulted to a bot. Validate BEFORE constructing: Room's own constructor throws
        // outside 5-10 players (Identity) / 5-12 players (Hegemony), and an uncaught throw here
        // (inside a raw message handler, no request boundary) would crash the whole process.
        const activeIds = gr.room.players.map((p) => p.id).filter((id) => gr.claimedSeats.has(id) || gr.botEnabledSlots.has(id));
        if (activeIds.length < MIN_PLAYERS) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: `Cần tối thiểu ${MIN_PLAYERS} người chơi (kể cả bot) để bắt đầu -- hiện có ${activeIds.length}.`,
            }),
          );
          return;
        }
        gr.room = new Room(activeIds, undefined, gr.mode); // rebuild with exactly the final roster -- role/win tables are sized per player count
        gr.room.setLiveUpdateCallback(() => broadcast(gr));
        gr.room.setPrivateRevealCallback((viewerId, reveal) => notifyClient(gr, viewerId, { type: "privateReveal", reveal }));
        for (const playerId of gr.claimedSeats.keys()) {
          gr.room.setController(playerId, makeHumanController(gr, playerId)); // bot-toggled seats already default to makeBotController
        }
        gr.started = true;
        broadcast(gr); // enters the pick-generals phase immediately (started but nobody picked yet)
        broadcastLobby();
        const room = gr.room; // capture the exact Room instance this startGame call is driving:
        // if the creator resets the room ("new") while pickGenerals() is still pending (e.g.
        // waiting up to 30s on a claimed human seat's general pick), this stale background call
        // must NOT schedule the turn loop against whatever DIFFERENT (fresh, ungenerated) Room
        // gr.room now points to -- that was the exact crash: playTurn() throwing because
        // pickGenerals() never ran on the room the loop actually started ticking against.
        // scheduleLoop itself re-checks `gr.room === room` on every tick (see its own comment)
        // so a LATER reset can't hijack this loop onto a fresh room either.
        void (async () => {
          await room.pickGenerals(() => broadcast(gr)); // broadcasts before/after every pick
          if (gr.room === room) scheduleLoop(gr, room); // only start the loop if still the current room
        })();
        break;
      }
      case "toggleBot": {
        const gr = wsRoom.get(ws);
        if (!gr || gr.started) return;
        if (gr.creatorWs !== ws) {
          ws.send(JSON.stringify({ type: "error", message: "Chỉ người tạo phòng mới có thể bật/tắt bot." }));
          return;
        }
        const playerId = String(msg.playerId);
        if (!gr.room.players.some((p) => p.id === playerId)) return;
        if (gr.claimedSeats.has(playerId)) return; // a claimed seat can't also be bot-toggled
        if (gr.botEnabledSlots.has(playerId)) gr.botEnabledSlots.delete(playerId);
        else gr.botEnabledSlots.add(playerId);
        broadcast(gr);
        broadcastLobby();
        break;
      }
      case "new": {
        const gr = wsRoom.get(ws);
        if (!gr) return;
        if (gr.creatorWs !== ws) {
          ws.send(JSON.stringify({ type: "error", message: "Chỉ người tạo phòng mới có thể bắt đầu ván mới." }));
          return;
        }
        releaseSeatsHeldBy(gr, ws); // don't carry a stale claim's socket-specific state across resets
        clearTimeout(gr.loopTimer ?? undefined);
        gr.loopTimer = null;
        gr.started = false; // back to the waiting room; the creator must start it again
        gr.room = new Room(newPlayerIds(gr.mode === GameMode.Hegemony ? MAX_PLAYERS_HEGEMONY : MAX_PLAYERS_IDENTITY), undefined, gr.mode); // back to the mode's full display slots --
        // botEnabledSlots/claimedSeats deliberately persist across a reset for a quick rematch
        gr.room.setLiveUpdateCallback(() => broadcast(gr)); // fresh Room instance -- re-register
        gr.room.setPrivateRevealCallback((viewerId, reveal) => notifyClient(gr, viewerId, { type: "privateReveal", reveal }));
        reapplyClaims(gr);
        broadcast(gr);
        broadcastLobby();
        break;
      }
      case "claim": {
        const gr = wsRoom.get(ws);
        if (!gr) return;
        if (gr.started) {
          ws.send(JSON.stringify({ type: "error", message: "Không thể chiếm ghế khi trận đấu đã diễn ra." }));
          return;
        }
        const playerId = String(msg.playerId);
        if (!gr.room.players.some((p) => p.id === playerId)) return;
        const holder = gr.claimedSeats.get(playerId);
        if (holder && holder !== ws && holder.readyState === WebSocket.OPEN) return; // already taken
        releaseSeatsHeldBy(gr, ws); // switching seats -- release any OTHER seat this socket already held
        gr.botEnabledSlots.delete(playerId); // claiming a seat overrides any bot toggle on it
        gr.claimedSeats.set(playerId, ws);
        gr.room.setController(playerId, makeHumanController(gr, playerId));
        broadcast(gr);
        break;
      }
      case "unclaim": {
        const gr = wsRoom.get(ws);
        if (!gr) return;
        const playerId = String(msg.playerId);
        if (gr.claimedSeats.get(playerId) === ws) {
          gr.claimedSeats.delete(playerId);
          gr.room.setController(playerId, null);
          broadcast(gr);
        }
        break;
      }
      case "response": {
        const gr = wsRoom.get(ws);
        if (!gr) return;
        const resolve = gr.pendingRequests.get(String(msg.requestId));
        if (resolve) {
          gr.pendingRequests.delete(String(msg.requestId));
          resolve(msg);
        }
        break;
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`QSanguosha web port: open http://localhost:${PORT}/ to play (WebSocket API on the same port)`);
});
