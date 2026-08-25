// Smoke test / MVP1 proof-of-life: role distribution, phase cycling with card conservation,
// scripted win-condition checks, and (new) an end-to-end game driven purely by real Slash/Jink/
// Peach combat + the naive bot policy, proving the whole pipeline converges to a win. Run with
// `npm run sim`.

import strict from "node:assert/strict";
import { Card, CardKind, Suit, buildStandardDeck } from "./card.js";
import { Room } from "./room.js";
import { GamePlayer } from "./player.js";
import { EngineContext, effectiveDistance, loseHp, resolveSlash } from "./combat.js";
import { SKILLS } from "./skill.js";
import { slashCandidates } from "./controller.js";
import { duelCandidates, resolveArcheryAttack, resolveSavageAssault, snatchCandidates } from "./trick.js";
import { Role } from "./types.js";
const DECK_SIZE = 54 + 15 + 16; // basics(Slash-family 29+Jink 14+Peach 8+Analeptic 3) + implemented tricks(15) + equips(10 weapons+6 horses), see card.ts

function playerIds(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `P${i + 1}`);
}

// Deterministic PRNG (mulberry32) so the emergent-combat test is reproducible.
function seededRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function totalCardsInPlay(room: Room): number {
  const inHands = room.players.reduce((sum, p) => sum + p.handcardNum, 0);
  const equipped = room.players.reduce(
    (sum, p) => sum + (p.weapon ? 1 : 0) + (p.defenseHorse ? 1 : 0) + (p.offenseHorse ? 1 : 0),
    0,
  );
  return inHands + equipped + room.drawPile.length + room.discardPile.length;
}

async function testRoleDistribution(): Promise<void> {
  const room = new Room(playerIds(8));
  const counts: Record<string, number> = { lord: 0, loyalist: 0, rebel: 0, renegade: 0 };
  for (const p of room.players) counts[p.role]++;
  strict.deepEqual(counts, { lord: 1, loyalist: 2, rebel: 4, renegade: 1 });
  strict.equal(
    room.players.filter((p) => p.roleShown).length,
    0,
    "nobody's role is shown yet at Room construction -- the lobby/waiting room, before the match starts",
  );
  await room.pickGenerals();
  strict.equal(room.players.filter((p) => p.roleShown).length, 1, "only the lord is shown once the match has started");
  strict.ok(
    room.players.find((p) => p.role === Role.Lord)!.roleShown,
    "specifically the lord, not some other seat, must be the one revealed",
  );
  console.log("PASS testRoleDistribution:", counts);
}

async function testPhaseCyclingConservesCards(): Promise<void> {
  const room = new Room(playerIds(8), seededRng(1));
  await room.pickGenerals();
  strict.ok(
    room.players.every((p) => p.handcardNum === p.maxHp),
    "every player starts with a hand equal to their general's max hp",
  );
  strict.equal(totalCardsInPlay(room), DECK_SIZE, "deck size before any turns");

  for (let i = 0; i < 20 && !room.gameOver; i++) await room.playTurn();

  strict.equal(
    totalCardsInPlay(room),
    DECK_SIZE,
    "every card must still be in a hand/draw-pile/discard-pile after cycling turns (none created/destroyed)",
  );
  console.log(
    "PASS testPhaseCyclingConservesCards: total cards still",
    totalCardsInPlay(room),
    "after",
    room.turnNumber,
    "turns, gameOver =",
    room.gameOver,
  );
}

async function testRebelKillsLord(): Promise<void> {
  const room = new Room(playerIds(8), seededRng(1));
  await room.pickGenerals();
  const lord = room.players.find((p) => p.role === Role.Lord)!;
  await room.damagePlayer(lord.id, lord.maxHp, Role.Rebel);
  strict.equal(lord.alive, false);
  strict.deepEqual(room.gameOver, { winners: [Role.Rebel] });
  console.log("PASS testRebelKillsLord:", room.gameOver);
}

async function testLordAndLoyalistWin(): Promise<void> {
  const room = new Room(playerIds(8), seededRng(1));
  await room.pickGenerals();
  const enemies = room.players.filter((p) => p.role === Role.Rebel || p.role === Role.Renegade);
  strict.equal(enemies.length, 5, "8p table has 4 rebels + 1 renegade");
  for (const enemy of enemies.slice(0, -1)) {
    await room.damagePlayer(enemy.id, enemy.maxHp, Role.Lord);
    strict.equal(room.gameOver, null, "side should not win until every rebel+renegade is dead");
  }
  const last = enemies[enemies.length - 1];
  await room.damagePlayer(last.id, last.maxHp, Role.Lord);
  strict.deepEqual(room.gameOver, { winners: [Role.Lord, Role.Loyalist] });
  console.log("PASS testLordAndLoyalistWin:", room.gameOver);
}

/**
 * Regression proof: a cascading death that happens AFTER the win condition is already decided
 * (e.g. Tianfeng's Suishi: an ally of the just-dead player loses 1 hp and can die from it too)
 * must NOT re-run checkWinCondition and overwrite the already-correct winner. Found live: an
 * unseeded testLordAndLoyalistWin run drew Suishi onto a loyalist, whose Suishi-triggered death
 * (credited to no side, per loseHp's null-killerRole rule) overwrote a correct
 * `{winners:[Rebel]}` result with the wrong `{winners:[Rebel,Renegade]}` "friendly fire" result.
 * Driven directly through Room.damagePlayer with Suishi force-assigned onto a 1-hp loyalist, so
 * the cascade is deterministic instead of depending on the random general draw.
 */
async function testCascadingDeathDoesNotOverwriteGameOver(): Promise<void> {
  const room = new Room(playerIds(8), seededRng(1));
  await room.pickGenerals();
  const lord = room.players.find((p) => p.role === Role.Lord)!;
  const loyalist = room.players.find((p) => p.role === Role.Loyalist)!;
  loyalist.skills = [SKILLS.suishi];
  loyalist.hp = 1; // Suishi's -1 hp on the lord's death must kill this ally too, in the same cascade

  await room.damagePlayer(lord.id, lord.maxHp, Role.Rebel);

  strict.equal(lord.alive, false, "lord must be dead");
  strict.equal(loyalist.alive, false, "the suishi-holding loyalist must also die from the ally-death cascade");
  strict.deepEqual(
    room.gameOver,
    { winners: [Role.Rebel] },
    "the lord's own credited death must stand; the loyalist's uncredited cascade death must not overwrite it",
  );
  console.log("PASS testCascadingDeathDoesNotOverwriteGameOver:", room.gameOver);
}

/**
 * Milestone 5 proof: a controller that defines `chooseFreeAction` gets the ENTIRE Play phase
 * handed to it -- proves 2 things the fixed automatic bot pass can't: (1) the human can choose
 * WHICH specific card to equip/play, not just yes/no on an auto-picked one, and (2) playing 2
 * held copies of the SAME trick kind (Ex Nihilo) in one turn works, since real Sanguosha has no
 * "once per kind per turn" cap (only Slash has an explicit limit) -- the bot-path's `tryPlayOnce`
 * only ever tries each kind once, so this specifically exercises the new freeform loop.
 */
async function testFreeformPlayLetsHumanChooseCardsAndPlayDuplicates(): Promise<void> {
  const room = new Room(playerIds(8), seededRng(1));
  await room.pickGenerals();
  const lord = room.players.find((p) => p.role === Role.Lord)!;
  const deck = buildStandardDeck();
  const exNihilo1 = deck.find((c) => c.kind === CardKind.ExNihilo)!;
  const exNihilo2 = deck.find((c) => c.kind === CardKind.ExNihilo && c.id !== exNihilo1.id)!;
  const weapon = deck.find((c) => c.kind === CardKind.Weapon)!;
  lord.hand = [exNihilo1, exNihilo2, weapon];

  let exNihiloPlays = 0;
  let equipped = false;
  room.setController(lord.id, {
    chooseFreeAction: async (_player, legalActions) => {
      // Only ever react to the 3 specific cards seeded above (declining everything else,
      // including whatever the Draw phase happens to add) keeps this deterministic.
      const myWeapon = legalActions.find((a) => a.kind === "equip" && a.cardId === weapon.id);
      if (myWeapon && !equipped) {
        equipped = true;
        return myWeapon;
      }
      const myExNihilo = legalActions.find(
        (a) => a.kind === "playCard" && a.cardKind === CardKind.ExNihilo && (a.cardId === exNihilo1.id || a.cardId === exNihilo2.id),
      );
      if (myExNihilo) {
        exNihiloPlays++;
        return myExNihilo;
      }
      return null; // end phase
    },
  });

  await room.playTurn(); // the lord acts first

  strict.equal(lord.weapon?.id, weapon.id, "freeform play must let the human choose exactly which card to equip");
  strict.equal(exNihiloPlays, 2, "both held ex nihilo copies must have been played in the same turn");
  strict.ok(
    !lord.hand.some((c) => c.id === exNihilo1.id || c.id === exNihilo2.id),
    "both played ex nihilo cards must have left the hand",
  );
  console.log("PASS testFreeformPlayLetsHumanChooseCardsAndPlayDuplicates: equipped chosen weapon, played both ex nihilo copies");
}

/**
 * Regression proof: equipping a Weapon/Horse must show up immediately for any watching client
 * (buffs like attack range/distance are already live server-side the instant `player.weapon` is
 * set -- this proves the NEW `setLiveUpdateCallback` hook fires synchronously right then, not
 * only once the whole turn finishes) instead of silently waiting for turn-end.
 */
async function testEquipTriggersLiveUpdateCallback(): Promise<void> {
  const room = new Room(playerIds(8), seededRng(1));
  await room.pickGenerals();
  const lord = room.players.find((p) => p.role === Role.Lord)!;
  const deck = buildStandardDeck();
  const weapon = deck.find((c) => c.kind === CardKind.Weapon)!;
  lord.hand = [weapon];

  // The Draw phase (now itself live-broadcasting -- see Milestone 16) fires its own callback
  // earlier in the same turn, before the weapon is ever equipped. Isolate specifically the
  // FIRST callback where the weapon transitions from unset to set, instead of assuming the
  // equip is the only call all turn.
  let equipTransitions = 0;
  let weaponSeenAtCallbackTime: string | null = null;
  let sawWeapon = false;
  room.setLiveUpdateCallback(() => {
    const current = lord.weapon?.weaponName ?? null;
    if (current && !sawWeapon) {
      equipTransitions++;
      weaponSeenAtCallbackTime = current;
      sawWeapon = true;
    }
  });

  let equipped = false;
  room.setController(lord.id, {
    chooseFreeAction: async (_player, legalActions) => {
      const myWeapon = legalActions.find((a) => a.kind === "equip" && a.cardId === weapon.id);
      if (myWeapon && !equipped) {
        equipped = true;
        return myWeapon;
      }
      return null; // end phase
    },
  });

  await room.playTurn(); // the lord acts first

  strict.equal(equipTransitions, 1, "the weapon must transition from unset to set in exactly one live-update callback");
  strict.equal(
    weaponSeenAtCallbackTime,
    weapon.weaponName,
    "player.weapon must already reflect the newly-equipped item at the moment the callback fires (synchronous, not delayed to turn end)",
  );
  console.log("PASS testEquipTriggersLiveUpdateCallback: equip fired the live-update callback synchronously with the buff already applied");
}

/**
 * Regression proof (companion to the equip test above): playing a Slash ON ANOTHER PLAYER must
 * also show up immediately for any watching client -- damage is applied synchronously inside
 * `resolveSlash`, but until every card-resolution helper (`tryPlaySlash`/`tryPlayTargeted`/
 * `tryPlayOnce`) called `onLiveUpdate` too, only `equip()` did, so Slash/Duel/Dismantlement/
 * Snatch/etc damage and hand changes still silently waited for turn-end like before Milestone 9.
 */
async function testSlashTriggersLiveUpdateCallback(): Promise<void> {
  const room = new Room(playerIds(8), seededRng(1));
  await room.pickGenerals();
  const lord = room.players.find((p) => p.role === Role.Lord)!;
  const deck = buildStandardDeck();
  const slash = deck.find((c) => c.kind === CardKind.Slash)!;
  lord.hand = [slash];
  for (const p of room.players) if (p !== lord) p.hand = []; // nobody holds a jink -- damage is guaranteed

  // The Draw phase (now itself live-broadcasting -- see Milestone 16) fires its own callback
  // earlier in the same turn, before the target is even chosen. Isolate specifically the FIRST
  // callback where the target's hp actually drops, instead of assuming the slash is the only
  // call all turn.
  let damageTransitions = 0;
  let targetHpAtCallbackTime: number | null = null;
  let sawDamage = false;
  const targetRef: { current: GamePlayer | null } = { current: null };
  room.setLiveUpdateCallback(() => {
    const t = targetRef.current;
    if (t && !sawDamage && t.hp < t.maxHp) {
      damageTransitions++;
      targetHpAtCallbackTime = t.hp;
      sawDamage = true;
    }
  });

  let played = false;
  room.setController(lord.id, {
    chooseFreeAction: async (_player, legalActions) => {
      const slashAction = legalActions.find(
        (a) => a.kind === "playCard" && a.cardKind === CardKind.Slash && a.cardId === slash.id,
      );
      if (slashAction && !played) {
        played = true;
        return slashAction;
      }
      return null; // end phase
    },
    chooseSlashTarget: async (_player, candidates) => {
      targetRef.current = candidates[0];
      return targetRef.current;
    },
  });

  await room.playTurn(); // the lord acts first

  strict.ok(played, "the freeform legalActions list must have offered the seeded slash card");
  strict.ok(targetRef.current, "chooseSlashTarget must have been asked and picked a target");
  const target = targetRef.current;
  strict.equal(damageTransitions, 1, "the target's hp must transition (drop) in exactly one live-update callback");
  strict.equal(
    targetHpAtCallbackTime,
    target.hp,
    "target.hp must already reflect the slash damage at the moment the callback fires (synchronous, not delayed to turn end)",
  );
  console.log("PASS testSlashTriggersLiveUpdateCallback: slash damage on another player was already applied when the live-update callback fired");
}

/**
 * Regression proof (companion to the ex-nihilo-duplicates test above): an AOE/untargeted card
 * (Savage Assault) must be offered unconditionally in the freeform legalActions list -- unlike
 * Slash/Duel/Dismantlement/Snatch it needs no candidate check -- and must resolve end to end with
 * NO target prompt at all, damaging every other player. Every other player's hand is cleared so
 * they have no Slash to discard, making the exactly-1-damage outcome fully deterministic.
 */
async function testFreeformPlayAOECardIsOfferedAndResolves(): Promise<void> {
  const room = new Room(playerIds(8), seededRng(1));
  await room.pickGenerals();
  const lord = room.players.find((p) => p.role === Role.Lord)!;
  const deck = buildStandardDeck();
  const savageAssault = deck.find((c) => c.kind === CardKind.SavageAssault)!;
  lord.hand = [savageAssault];
  for (const p of room.players) if (p !== lord) p.hand = [];
  const othersBefore = room.players.filter((p) => p !== lord).map((p) => ({ id: p.id, hp: p.hp }));

  let played = false;
  room.setController(lord.id, {
    chooseFreeAction: async (_player, legalActions) => {
      // Only ever react to the seeded card (declining everything else, including whatever the
      // Draw phase happens to add) keeps this deterministic.
      const savage = legalActions.find(
        (a) => a.kind === "playCard" && a.cardKind === CardKind.SavageAssault && a.cardId === savageAssault.id,
      );
      if (savage && !played) {
        played = true;
        return savage;
      }
      return null; // end phase
    },
  });

  await room.playTurn(); // the lord acts first

  strict.ok(played, "the freeform legalActions list must have offered the seeded savage assault card");
  strict.ok(!lord.hand.some((c) => c.id === savageAssault.id), "the played savage assault card must have left the hand");
  strict.ok(room.log.some((l) => l.includes("uses savage assault")), "savage assault must have actually resolved (log line present)");
  for (const before of othersBefore) {
    const after = room.players.find((p) => p.id === before.id)!;
    const immune = after.skills.some((s) => s.immuneToSavageAssault?.(after));
    const expected = before.hp - (immune ? 0 : 1);
    strict.equal(
      after.hp,
      expected,
      `${before.id} (empty-handed, no slash to discard${immune ? ", savageAssaultAvoid" : ""}) must take exactly ${immune ? 0 : 1} savage assault damage`,
    );
  }
  console.log(
    "PASS testFreeformPlayAOECardIsOfferedAndResolves: savage assault appeared in legalActions with no target prompt, resolved, damaged every other player",
  );
}

/**
 * Regression proof: Amazing Grace (Ngu Coc Phong Dang) must reveal exactly N cards (N = number
 * of alive players) and let each player pick ONE in turn order STARTING FROM THE CARD'S USER --
 * not a simultaneous/random draw. Every player's choosePickCard is overridden to pick the LAST
 * remaining card in the pool (deliberately different from the bot's own "first" default) and
 * record (order, pool size, chosen card) -- proves the ask is actually consulted, the revealed
 * pool shrinks by exactly 1 each turn, and turn order starts at the source and wraps around the
 * table in seat order.
 */
async function testAmazingGraceIsATurnOrderDraft(): Promise<void> {
  const room = new Room(playerIds(8), seededRng(1));
  await room.pickGenerals();
  const lord = room.players.find((p) => p.role === Role.Lord)!;
  const deck = buildStandardDeck();
  const amazingGrace = deck.find((c) => c.kind === CardKind.AmazingGrace)!;
  lord.hand = [amazingGrace];
  for (const p of room.players) if (p !== lord) p.hand = [];

  const picks: { playerId: string; poolSizeAtCallTime: number; chosenId: number }[] = [];
  for (const p of room.players) {
    room.setController(p.id, {
      choosePickCard: async (_player, candidates) => {
        const chosen = candidates[candidates.length - 1]; // deliberately the LAST, not the bot default's first
        picks.push({ playerId: p.id, poolSizeAtCallTime: candidates.length, chosenId: chosen.id });
        return chosen;
      },
    });
  }

  await room.playTurn(); // the lord acts first

  strict.equal(picks.length, 8, "exactly 8 (alive player count) cards must be revealed and picked, one per player");
  strict.equal(picks[0].playerId, lord.id, "the card's USER must pick first, not a random player");

  const lordIdx = room.players.indexOf(lord);
  const expectedOrder = Array.from({ length: 8 }, (_, i) => room.players[(lordIdx + i) % 8].id);
  strict.deepEqual(
    picks.map((p) => p.playerId),
    expectedOrder,
    "turn order must start at the user and wrap around the table in seat order, not be random",
  );
  strict.deepEqual(
    picks.map((p) => p.poolSizeAtCallTime),
    [8, 7, 6, 5, 4, 3, 2, 1],
    "the revealed pool must shrink by exactly 1 after each player's pick",
  );

  const chosenIds = picks.map((p) => p.chosenId);
  strict.equal(new Set(chosenIds).size, 8, "every picked card must be distinct -- no two players end up with the same card");
  for (const p of room.players) {
    const myPick = picks.find((pk) => pk.playerId === p.id)!;
    strict.ok(
      p.hand.some((c) => c.id === myPick.chosenId),
      `${p.id} must actually hold the exact card their choosePickCard chose (not an arbitrary default)`,
    );
  }
  console.log(
    "PASS testAmazingGraceIsATurnOrderDraft: 8 cards revealed, picked one at a time starting from the user, pool shrunk correctly, no duplicates",
  );
}

/**
 * Regression proof: the end-of-turn Discard phase must let the controller choose EXACTLY which
 * held cards to discard, not always the first N in hand order. Deliberately picks the LAST
 * `count` cards (the opposite end from the old arbitrary-first-N default) via `chooseDiscards`,
 * and confirms those exact cards -- not some default subset -- actually left the hand.
 */
async function testDiscardChoiceLetsHumanPickWhichCards(): Promise<void> {
  const room = new Room(playerIds(8), seededRng(1));
  await room.pickGenerals();
  const lord = room.players.find((p) => p.role === Role.Lord)!;
  lord.skills = []; // no keji (would skip the discard phase) or other interfering skill
  const deck = buildStandardDeck();
  // Peach/Analeptic are never proactively played by the fixed bot Play-phase pass, so this hand
  // survives untouched into the Discard phase regardless of what else the lord draws.
  lord.hand = deck.filter((c) => c.kind === CardKind.Peach || c.kind === CardKind.Analeptic).slice(0, 6);
  lord.hp = 2; // maxCards === hp === 2, so the post-draw hand is well over the limit

  let discardCountAsked: number | null = null;
  let chosenCards: Card[] | null = null;
  room.setController(lord.id, {
    wantsToEquip: async () => false,
    wantsToUseSelfAction: async () => false,
    wantsToPlayTrick: async () => false,
    chooseTrickTarget: async () => null,
    chooseSlashTarget: async () => null,
    chooseDiscards: async (player, count) => {
      discardCountAsked = count;
      chosenCards = player.hand.slice(-count); // the LAST `count` cards -- provably not the bot's "first N" default
      return chosenCards;
    },
  });

  await room.playTurn(); // the lord acts first: Draw adds 2, nothing gets played away, Discard asks

  strict.ok(discardCountAsked !== null, "chooseDiscards must have been called during the discard phase");
  strict.equal(lord.handcardNum, lord.maxCards, "hand must be exactly at the limit after discarding");
  strict.ok(
    chosenCards!.every((c) => !lord.hand.includes(c)),
    "every specifically-chosen card must have actually left the hand",
  );
  console.log(
    "PASS testDiscardChoiceLetsHumanPickWhichCards: chooseDiscards's exact chosen cards were discarded (not an arbitrary default set)",
  );
}

/**
 * Regression proof: the Draw phase must ask the controller's `wantsToDrawNow` BEFORE any card
 * is actually drawn to hand -- lets a human seat draw on their own timing (click the pile)
 * instead of cards silently appearing. Deterministic without needing to simulate real-time
 * pausing: `Room.runPhase`'s Draw case `await`s the controller's answer before ever calling
 * `drawCards`, so the ask's own hand-size snapshot (captured synchronously as its very first
 * statement, before it returns) reliably proves the ordering regardless of resolution speed.
 */
async function testDrawPhaseAsksBeforeDrawing(): Promise<void> {
  const room = new Room(playerIds(8), seededRng(1));
  await room.pickGenerals();
  const lord = room.players.find((p) => p.role === Role.Lord)!;
  const handBeforeDraw = lord.handcardNum;

  let askedCount = 0;
  let countAsked: number | null = null;
  let handSizeAtAskTime: number | null = null;
  room.setController(lord.id, {
    wantsToDrawNow: async (player, count) => {
      askedCount++;
      countAsked = count;
      handSizeAtAskTime = player.handcardNum;
    },
  });

  await room.playTurn(); // the lord acts first

  strict.equal(askedCount, 1, "wantsToDrawNow must be asked exactly once per Draw phase");
  strict.equal(countAsked, 2, "default draw count is 2 with no yingzi/luoyi modifier");
  strict.equal(
    handSizeAtAskTime,
    handBeforeDraw,
    "the ask must fire BEFORE drawCards runs -- hand size at ask time must still be the pre-draw count",
  );
  console.log("PASS testDrawPhaseAsksBeforeDrawing: wantsToDrawNow asked exactly once, correct count, strictly before the draw itself");
}

/**
 * Proves Milestone 1 end to end: with NO scripted damage, real Slash/Jink/Peach card resolution
 * (combat.ts) driven by the naive random-target bot must, on its own, reduce someone's hp to 0
 * and trigger checkWinCondition. Runs several seeds since the naive bot has no ally-awareness and
 * a single seed could in principle stall (deck exhaustion without any hp ever reaching 0).
 */
async function testEmergentCombatReachesWinCondition(): Promise<void> {
  const MAX_TURNS = 3000;
  let converged = false;
  for (let seed = 1; seed <= 20 && !converged; seed++) {
    const room = new Room(playerIds(8), seededRng(seed));
    await room.pickGenerals();
    await room.runUntilGameOver(MAX_TURNS);
    if (room.gameOver) {
      console.log(
        `PASS testEmergentCombatReachesWinCondition: seed ${seed} -> ${room.gameOver.winners.join("+")} win after ${room.turnNumber} turns`,
      );
      converged = true;
    }
  }
  strict.ok(converged, `no seed reached a win condition within ${MAX_TURNS} turns across 20 seeds`);
}

/**
 * Milestone 1.5 proof: confirms the equip pass and each of the 8 implemented trick cards
 * actually get exercised through the real Play-phase pipeline (not just type-checked), by
 * scanning room logs across enough turns/seeds for each kind's log message to appear at least
 * once. GodSalvation is conditional (only played when someone is wounded) so it's checked but
 * not required.
 */
async function testEquipAndTricksAppearInPlay(): Promise<void> {
  const seen = new Set<string>();
  const markers: [string, RegExp][] = [
    ["equip", /equips/],
    ["ex nihilo", /ex nihilo/],
    ["dismantlement", /dismantlement/],
    ["snatch", /snatches/],
    ["duel", /duels|plays slash in the duel/],
    ["savage assault", /savage assault/],
    ["archery attack", /archery attack/],
    ["amazing grace", /amazing grace/],
    ["god salvation", /god salvation/],
  ];
  for (let seed = 100; seed < 140; seed++) {
    const room = new Room(playerIds(8), seededRng(seed));
    await room.pickGenerals();
    await room.runUntilGameOver(200);
    for (const line of room.log) {
      for (const [name, re] of markers) if (re.test(line)) seen.add(name);
    }
  }
  const required = markers.map(([name]) => name).filter((name) => name !== "god salvation");
  const missing = required.filter((name) => !seen.has(name));
  strict.deepEqual(missing, [], `expected log markers never observed: ${missing.join(", ")}`);
  console.log("PASS testEquipAndTricksAppearInPlay: observed", [...seen].sort().join(", "));
}

/**
 * Milestone 2/2.6 proof: confirms all 44 ported generals get assigned and as many of their
 * skills as can reliably be log-mined actually fire through real play. Kongcheng/Qianxun/
 * Liegong/Qicai/Mashu/Wushuang/SavageAssaultAvoid are proven separately (dedicated tests below)
 * since they're either passive filters with no log line, or gated behind a rare precondition
 * (e.g. Wushuang needs 2 held Jinks at once) too unreliable to log-mine in a fixed seed range.
 */
async function testGeneralSkillsAppearInPlay(): Promise<void> {
  const generalsSeen = new Set<string>();
  let sawMultiSlashTurn = false;
  const markers: [string, string][] = [
    ["slashViewAs", "views a card as slash (viewAs skill)"],
    ["jinkViewAs", "views a card as jink (viewAs skill)"],
    ["dismantlementViewAs", "views a card as dismantlement (viewAs skill)"],
    ["peachViewAs", "views a card as peach (viewAs skill)"], // jijiu
    ["ganglieJudge", "ganglie judge"],
    ["ganglieDiscard", "discards 2 cards (ganglie)"],
    ["tieqiJudge", "tieqi judge"],
    ["tieqiBlock", "cannot dodge this slash (tieqi)"],
    ["fankuiTake", "(fankui)"],
    ["kurouUse", "uses kurou"],
    ["kuangguRecover", "(kuanggu)"],
    ["jianxiongTake", "(jianxiong)"],
    ["yingziBonus", "(yingzi)"],
    ["jizhiDraw", "(jizhi)"],
    ["xiangleDiscard", "(xiangle)"],
    ["huoshouCredit", "(huoshou)"],
    ["juxiangClaim", "(juxiang)"],
    ["shushenDraw", "(shushen)"],
    ["shenzhi", "(shenzhi)"],
    ["tuxiSteal", "(tuxi)"],
    ["luoyi", "(luoyi)"],
    ["yiji", "(yiji)"],
    ["qiangxi", "uses qiangxi on"],
    ["jieming", "(jieming)"],
    ["xingshangClaim", "(xingshang)"],
    ["xiaoguo", "(xiaoguo)"],
    ["keji", "(keji)"],
    ["liuli", "(liuli)"],
    ["xiaoji", "(xiaoji)"],
    ["yinghun", "(yinghun)"],
    ["haoshi", "(haoshi)"],
    ["guzheng", "(guzheng)"],
    ["qingnang", "(qingnang)"],
    ["biyue", "(biyue)"],
    ["shuangxiongJudge", "shuangxiong judge:"],
    ["weimuBlock", "(weimu)"],
    ["mengjin", "(mengjin)"],
    ["leijiJudge", "leiji judge:"],
    ["beigeJudge", "beige judge:"],
    ["mingshiReduce", "(mingshi)"],
    ["sijian", "(sijian)"],
    ["suishiDraw", "(suishi)"],
  ];
  const seen = new Set<string>();

  for (let seed = 200; seed < 350; seed++) {
    const room = new Room(playerIds(8), seededRng(seed));
    await room.pickGenerals();
    for (const p of room.players) generalsSeen.add(p.general);
    await room.runUntilGameOver(200);

    let currentTurnSlashCount = 0;
    for (const line of room.log) {
      if (line.startsWith("--- Turn")) currentTurnSlashCount = 0;
      if (/ slashes /.test(line)) {
        currentTurnSlashCount++;
        if (currentTurnSlashCount > 1) sawMultiSlashTurn = true;
      }
      for (const [name, substr] of markers) if (line.includes(substr)) seen.add(name);
    }
  }

  strict.deepEqual(
    [...generalsSeen].sort(),
    [
      "caiwenji", "caocao", "caopi", "daqiao", "dianwei", "diaochan", "erzhang", "ganfuren",
      "ganning", "guanyu", "guojia", "huanggai", "huangyueying", "huangzhong", "huatuo", "jiaxu",
      "kongrong", "liushan", "lusu", "luxun", "lvbu", "lvmeng", "machao", "mateng", "menghuo",
      "pangde", "simayi", "sunjian", "sunshangxiang", "tianfeng", "weiyan", "xiahoudun", "xuchu",
      "xunyu", "yanliangwenchou", "yuejin", "zhangfei", "zhangjiao", "zhangliao", "zhaoyun",
      "zhenji", "zhouyu", "zhugeliang", "zhurong",
    ],
    "all 44 ported generals must appear across 150 seeds of 8-player games",
  );
  strict.ok(sawMultiSlashTurn, "paoxiao (zhangfei) never allowed >1 slash in a single turn");
  const missing = markers.map(([name]) => name).filter((name) => !seen.has(name));
  strict.deepEqual(missing, [], `expected skill log markers never observed: ${missing.join(", ")}`);
  console.log(
    "PASS testGeneralSkillsAppearInPlay:",
    generalsSeen.size,
    "generals,",
    seen.size,
    "of",
    markers.length,
    "skill markers observed, multiSlash observed",
  );
}

/**
 * Milestone 3.9 proof: Qianxun (Lu Xun) makes him immune to being chosen as a Snatch target, via
 * snatchCandidates directly (pure, deterministic -- see the module comment above for why).
 */
function testQianxunImmunity(): void {
  const filler = buildStandardDeck()[0];
  const actor = new GamePlayer("PA");
  const luxun = new GamePlayer("PB");
  luxun.skills = [SKILLS.qianxun];
  luxun.hand = [filler];
  const bystander = new GamePlayer("PC");
  bystander.hand = [filler];
  const alive = [actor, luxun, bystander];

  const snatchTargets = snatchCandidates(actor, alive);
  strict.ok(!snatchTargets.includes(luxun), "qianxun must never be a legal snatch target");
  strict.ok(snatchTargets.includes(bystander), "a non-qianxun holder with cards must remain a legal snatch target");
  console.log("PASS testQianxunImmunity: qianxun excluded from snatch candidates, bystander included");
}

/**
 * Milestone 3.9 proof: Kongcheng (Zhuge Liang) makes an empty-handed player immune to being
 * chosen as a Slash/Duel target, via slashCandidates/duelCandidates directly (pure, deterministic
 * -- see the module comment above for why this isn't log-mined like the other 6 generals).
 */
function testKongchengImmunity(): void {
  const filler = buildStandardDeck()[0];
  const actor = new GamePlayer("PA");
  const emptyHanded = new GamePlayer("PB");
  emptyHanded.skills = [SKILLS.kongcheng];
  const fullHanded = new GamePlayer("PC");
  fullHanded.skills = [SKILLS.kongcheng];
  fullHanded.hand = [filler];
  const alive = [actor, emptyHanded, fullHanded];

  const slashTargets = slashCandidates(alive, actor);
  const duelTargets = duelCandidates(actor, alive);
  strict.ok(!slashTargets.includes(emptyHanded), "kongcheng with an empty hand must never be a legal slash target");
  strict.ok(!duelTargets.includes(emptyHanded), "kongcheng with an empty hand must never be a legal duel target");
  strict.ok(slashTargets.includes(fullHanded), "kongcheng with cards in hand must remain a legal slash target");
  strict.ok(duelTargets.includes(fullHanded), "kongcheng with cards in hand must remain a legal duel target");
  console.log("PASS testKongchengImmunity: empty-handed kongcheng excluded from both candidate lists, full-handed included");
}

/**
 * Milestone 2.6 proof: Qicai (Huangyueying) lets her ignore Snatch's distance-1 limit, via
 * snatchCandidates directly (pure, deterministic -- no log line distinguishes this from a normal
 * in-range Snatch, so it can't be log-mined like the other markers).
 */
function testQicaiIgnoresSnatchDistance(): void {
  const filler = buildStandardDeck()[0];
  const actor = new GamePlayer("PA");
  actor.skills = [SKILLS.qicai];
  const farTarget = new GamePlayer("PB");
  farTarget.hand = [filler];
  // Seat farTarget directly across an 8-player circular table (3 bystanders on each side) so its
  // circular distance from actor is 4, not 1 (appending it last would wrap back to adjacent).
  const before = Array.from({ length: 3 }, (_, i) => new GamePlayer(`FILLB${i}`));
  const after = Array.from({ length: 3 }, (_, i) => new GamePlayer(`FILLA${i}`));
  const alive = [actor, ...before, farTarget, ...after];
  strict.ok(effectiveDistance(alive, actor, farTarget) > 1, "test setup must actually place the target beyond distance 1");

  const withQicai = snatchCandidates(actor, alive);
  strict.ok(withQicai.includes(farTarget), "qicai must let a beyond-distance-1 target remain a legal snatch target");

  actor.skills = [];
  const withoutQicai = snatchCandidates(actor, alive);
  strict.ok(!withoutQicai.includes(farTarget), "without qicai the same target must be excluded by the distance-1 limit");
  console.log("PASS testQicaiIgnoresSnatchDistance: qicai included a distance-3 target, its absence excluded the same target");
}

/**
 * Milestone 2.6 proof: Mashu (Pangde/Mateng) reduces the holder's effective distance to every
 * other player by 1, via effectiveDistance directly (pure, deterministic, shares the exact shape
 * already proven for the offense-horse delta).
 */
function testMashuReducesDistance(): void {
  const holder = new GamePlayer("PA");
  const side1 = new GamePlayer("PC1");
  const other = new GamePlayer("PB"); // seated directly across a 4-player table: seat distance 2
  const side2 = new GamePlayer("PC2");
  const alive = [holder, side1, other, side2];
  const baseline = effectiveDistance(alive, holder, other);
  strict.equal(baseline, 2, "test setup must place the target at seat distance 2 so the -1 delta is observable under the floor-at-1 rule");

  holder.skills = [SKILLS.mashu];
  strict.equal(effectiveDistance(alive, holder, other), baseline - 1, "mashu must reduce the holder's effective distance to others by 1");
  strict.equal(effectiveDistance(alive, other, holder), baseline, "mashu only affects the holder's OWN offensive distance, not others' distance to the holder");
  console.log("PASS testMashuReducesDistance: mashu holder's outgoing distance reduced by 1, incoming distance unaffected");
}

/**
 * Milestone 2.6 proof: SavageAssaultAvoid (Menghuo/Zhurong) makes the holder immune to Savage
 * Assault's per-player Slash-or-take-damage choice entirely -- not offered the choice and not
 * damaged -- driven directly through resolveSavageAssault (pure, deterministic).
 */
async function testSavageAssaultAvoidImmunity(): Promise<void> {
  const source = new GamePlayer("SRC");
  const immune = new GamePlayer("IMM");
  immune.skills = [SKILLS.savageAssaultAvoid];
  const normal = new GamePlayer("NRM");
  const log: string[] = [];
  const ctx = makeTestContext([source, immune, normal], log);

  await resolveSavageAssault(ctx, source);

  strict.equal(immune.hp, immune.maxHp, "savageAssaultAvoid must take no damage from savage assault");
  strict.equal(normal.hp, normal.maxHp - 1, "a non-immune empty-handed player must still take savage assault damage");
  console.log("PASS testSavageAssaultAvoidImmunity: immune player untouched, normal player took the expected damage");
}

/**
 * Regression proof: Savage Assault/Archery Attack must offer each affected player a real choice
 * to discard their held Slash/Jink (vs. take 1 damage), not auto-spend it -- matching real
 * Sanguosha rules and the same "player's choice" shape as resolveSlash's Jink/resolveDuel's
 * Slash. Declining must leave the card unspent in hand AND still deal exactly 1 damage;
 * accepting must spend it AND deal 0 damage. Driven directly through resolveSavageAssault/
 * resolveArcheryAttack (pure, deterministic).
 */
async function testSavageAssaultAndArcheryAttackAreAChoice(): Promise<void> {
  const deck = buildStandardDeck();
  const slashA = deck.find((c) => c.kind === CardKind.Slash)!;
  const slashB = deck.find((c) => c.kind === CardKind.Slash && c.id !== slashA.id)!;
  const jinkA = deck.find((c) => c.kind === CardKind.Jink)!;
  const jinkB = deck.find((c) => c.kind === CardKind.Jink && c.id !== jinkA.id)!;

  const decliner = new GamePlayer("DEC");
  decliner.hand = [slashA];
  const ctxDecline = makeTestContext([new GamePlayer("SRC1"), decliner], []);
  ctxDecline.askSavageAssaultSlash = async () => false;
  await resolveSavageAssault(ctxDecline, ctxDecline.alivePlayers[0]);
  strict.equal(decliner.hp, decliner.maxHp - 1, "declining to discard for savage assault must still deal 1 damage");
  strict.ok(decliner.hand.includes(slashA), "declining must leave the held slash unspent in hand");

  const accepter = new GamePlayer("ACC");
  accepter.hand = [slashB];
  const ctxAccept = makeTestContext([new GamePlayer("SRC2"), accepter], []);
  ctxAccept.askSavageAssaultSlash = async () => true;
  await resolveSavageAssault(ctxAccept, ctxAccept.alivePlayers[0]);
  strict.equal(accepter.hp, accepter.maxHp, "accepting to discard for savage assault must avoid damage");
  strict.ok(!accepter.hand.includes(slashB), "accepting must spend the held slash from hand");

  const decliner2 = new GamePlayer("DEC2");
  decliner2.hand = [jinkA];
  const ctxDecline2 = makeTestContext([new GamePlayer("SRC3"), decliner2], []);
  ctxDecline2.askArcheryAttackJink = async () => false;
  await resolveArcheryAttack(ctxDecline2, ctxDecline2.alivePlayers[0]);
  strict.equal(decliner2.hp, decliner2.maxHp - 1, "declining to discard for archery attack must still deal 1 damage");
  strict.ok(decliner2.hand.includes(jinkA), "declining must leave the held jink unspent in hand");

  const accepter2 = new GamePlayer("ACC2");
  accepter2.hand = [jinkB];
  const ctxAccept2 = makeTestContext([new GamePlayer("SRC4"), accepter2], []);
  ctxAccept2.askArcheryAttackJink = async () => true;
  await resolveArcheryAttack(ctxAccept2, ctxAccept2.alivePlayers[0]);
  strict.equal(accepter2.hp, accepter2.maxHp, "accepting to discard for archery attack must avoid damage");
  strict.ok(!accepter2.hand.includes(jinkB), "accepting must spend the held jink from hand");

  console.log(
    "PASS testSavageAssaultAndArcheryAttackAreAChoice: declining kept the card and took damage, accepting spent it and avoided damage (slash + jink)",
  );
}

/** Builds a minimal EngineContext for combat.ts unit tests that don't need a full Room. */
function makeTestContext(alivePlayers: GamePlayer[], log: string[], drawTop: () => Card | null = () => null): EngineContext {
  return {
    alivePlayers,
    discardPile: [],
    log,
    rng: Math.random,
    draw: () => {},
    drawTop,
    onDying: () => {},
    askDodge: async () => true,
    askPeach: async () => false,
    askDuelSlash: async () => false,
    askGanglieDiscard: async () => false,
    askUseSelfAction: async () => true,
    askChooseAnyPlayer: async (_player, candidates) => candidates[0] ?? null,
    askSavageAssaultSlash: async () => true,
    askArcheryAttackJink: async () => true,
    askPickCard: async (_player, candidates) => candidates[0],
  };
}

/**
 * Milestone 3.9 proof: Tieqi (Ma Chao) blocks the dodge decision entirely -- not just the log
 * text -- when its judge draws a red card: the target's held Jink must go unspent and damage
 * must land, driven directly through resolveSlash (pure, deterministic).
 */
async function testTieqiBlocksDodge(): Promise<void> {
  const attacker = new GamePlayer("A");
  attacker.skills = [SKILLS.tieqi];
  const target = new GamePlayer("B");
  const deck = buildStandardDeck();
  const jink = deck.find((c) => c.kind === CardKind.Jink)!;
  const slashCard = deck.find((c) => c.kind === CardKind.Slash)!;
  const redJudgeCard = deck.find((c) => c.suit === Suit.Heart)!;
  target.hand = [jink];

  const log: string[] = [];
  let askDodgeCalled = false;
  const ctx = makeTestContext([attacker, target], log, () => redJudgeCard);
  ctx.askDodge = async () => {
    askDodgeCalled = true;
    return true;
  };

  await resolveSlash(ctx, attacker, target, slashCard);

  strict.equal(askDodgeCalled, false, "tieqi must block the dodge decision itself, not just decline it");
  strict.equal(target.hp, target.maxHp - 1, "damage must land since tieqi blocked the dodge");
  strict.ok(target.hand.includes(jink), "target's jink must remain unspent since the dodge was blocked");
  strict.ok(log.some((l) => l.includes("cannot dodge this slash (tieqi)")));
  console.log("PASS testTieqiBlocksDodge: red judge blocked the dodge decision, jink stayed in hand, damage landed");
}

/**
 * Milestone 3.9 proof: Longdan (Zhao Yun) lets a held Slash be viewed as Jink to dodge, and
 * Qingguo (Zhen Ji) lets a held black card be viewed as Jink to dodge -- driven directly through
 * resolveSlash (pure, deterministic).
 */
async function testViewAsJinkDodges(): Promise<void> {
  const deck = buildStandardDeck();
  const realSlash = deck.find((c) => c.kind === CardKind.Slash)!;

  const longdanTarget = new GamePlayer("LD");
  longdanTarget.skills = [SKILLS.longdan];
  const slashAsJink = deck.find((c) => c.kind === CardKind.Slash && c.id !== realSlash.id)!;
  longdanTarget.hand = [slashAsJink];
  await resolveSlash(makeTestContext([new GamePlayer("ATK1"), longdanTarget], []), new GamePlayer("ATK1"), longdanTarget, realSlash);
  strict.equal(longdanTarget.hp, longdanTarget.maxHp, "longdan must let a held slash view as jink to dodge");
  strict.ok(!longdanTarget.hand.includes(slashAsJink), "the viewed-as-jink card must be spent from hand");

  const qingguoTarget = new GamePlayer("QG");
  qingguoTarget.skills = [SKILLS.qingguo];
  const blackCard = deck.find((c) => c.kind !== CardKind.Jink && (c.suit === Suit.Spade || c.suit === Suit.Club))!;
  qingguoTarget.hand = [blackCard];
  const realSlash2 = deck.find((c) => c.kind === CardKind.Slash && c.id !== realSlash.id && c.id !== slashAsJink.id)!;
  await resolveSlash(makeTestContext([new GamePlayer("ATK2"), qingguoTarget], []), new GamePlayer("ATK2"), qingguoTarget, realSlash2);
  strict.equal(qingguoTarget.hp, qingguoTarget.maxHp, "qingguo must let a held black card view as jink to dodge");
  strict.ok(!qingguoTarget.hand.includes(blackCard), "the viewed-as-jink card must be spent from hand");

  console.log("PASS testViewAsJinkDodges: longdan (slash-as-jink) and qingguo (black-card-as-jink) both dodged");
}

/**
 * Milestone 2.6 proof: Liegong (Huangzhong) blocks the dodge decision entirely -- same
 * onSlashTargeted shape as Tieqi -- when the target's handcard count is <= the attacker's attack
 * range (the "weak target" branch; the >= attacker's hp branch is the same OR'd condition and
 * not separately exercised here), driven directly through resolveSlash (pure, deterministic).
 */
async function testLiegongBlocksJink(): Promise<void> {
  const attacker = new GamePlayer("A");
  attacker.skills = [SKILLS.liegong]; // default attackRange 1 (no weapon)
  const target = new GamePlayer("B");
  const deck = buildStandardDeck();
  const jink = deck.find((c) => c.kind === CardKind.Jink)!;
  const slashCard = deck.find((c) => c.kind === CardKind.Slash)!;
  target.hand = [jink]; // exactly 1 card <= attacker's attackRange of 1

  const log: string[] = [];
  let askDodgeCalled = false;
  const ctx = makeTestContext([attacker, target], log);
  ctx.askDodge = async () => {
    askDodgeCalled = true;
    return true;
  };

  await resolveSlash(ctx, attacker, target, slashCard);

  strict.equal(askDodgeCalled, false, "liegong must block the dodge decision itself when the target is weak enough");
  strict.equal(target.hp, target.maxHp - 1, "damage must land since liegong blocked the dodge");
  strict.ok(target.hand.includes(jink), "target's jink must remain unspent since the dodge was blocked");
  console.log("PASS testLiegongBlocksJink: weak-handed target's dodge decision blocked, jink stayed in hand, damage landed");
}

/**
 * Milestone 2.6 proof: Wushuang (Lu Bu) requires 2 Jinks (not 1) to dodge a Slash -- with only 1
 * Jink in hand the dodge must fail and damage must land; with 2 Jinks it must succeed and both
 * get spent -- driven directly through resolveSlash (pure, deterministic; too rare a hand shape
 * to reliably log-mine).
 */
async function testWushuangRequiresTwoJinks(): Promise<void> {
  const deck = buildStandardDeck();
  const jinks = deck.filter((c) => c.kind === CardKind.Jink);
  strict.ok(jinks.length >= 2, "test setup needs at least 2 jink cards in the standard deck");
  const slash1 = deck.find((c) => c.kind === CardKind.Slash)!;
  const slash2 = deck.find((c) => c.kind === CardKind.Slash && c.id !== slash1.id)!;

  const oneJinkTarget = new GamePlayer("LB1");
  oneJinkTarget.skills = [SKILLS.wushuang];
  oneJinkTarget.hand = [jinks[0]];
  await resolveSlash(makeTestContext([new GamePlayer("ATK1"), oneJinkTarget], []), new GamePlayer("ATK1"), oneJinkTarget, slash1);
  strict.equal(oneJinkTarget.hp, oneJinkTarget.maxHp - 1, "with only 1 jink, wushuang's target must fail to dodge and take damage");
  strict.ok(oneJinkTarget.hand.includes(jinks[0]), "the single unspendable jink must remain in hand (never consumed on a failed dodge)");

  const twoJinkTarget = new GamePlayer("LB2");
  twoJinkTarget.skills = [SKILLS.wushuang];
  twoJinkTarget.hand = [jinks[0], jinks[1]];
  await resolveSlash(makeTestContext([new GamePlayer("ATK2"), twoJinkTarget], []), new GamePlayer("ATK2"), twoJinkTarget, slash2);
  strict.equal(twoJinkTarget.hp, twoJinkTarget.maxHp, "with 2 jinks, wushuang's target must successfully dodge and take no damage");
  strict.ok(!twoJinkTarget.hand.includes(jinks[0]) && !twoJinkTarget.hand.includes(jinks[1]), "both jinks must be spent on a successful 2-jink dodge");

  console.log("PASS testWushuangRequiresTwoJinks: 1 jink failed to dodge (damage landed), 2 jinks dodged (both spent)");
}

/**
 * Milestone 3.9 proof: Kurou's `loseHp` path can kill (at 1 hp) and credits no side (`killerRole`
 * null) -- distinct from Slash/Duel damage, which always credits the attacker's role. Driven
 * directly through `loseHp` (pure, deterministic).
 */
async function testKurouSelfInflictedDeathCreditsNoKiller(): Promise<void> {
  const player = new GamePlayer("K", 1); // maxHp 1: loseHp(1) drops it to 0 with no Peach to save it
  let dyingKillerRole: string | null | undefined;
  const ctx = makeTestContext([player], []);
  ctx.onDying = (p, killerRole) => {
    p.alive = false;
    dyingKillerRole = killerRole;
  };

  await loseHp(ctx, player, 1);

  strict.equal(player.alive, false, "loseHp must be able to kill when it drops hp to 0 with no rescue");
  strict.equal(dyingKillerRole, null, "a self-inflicted loseHp death must credit no side (killerRole null)");
  console.log("PASS testKurouSelfInflictedDeathCreditsNoKiller: loseHp killed with a null credited killer");
}

/**
 * Milestone 3.5 proof: Room.setController actually overrides the bot for one seat. Installs a
 * controller on P1 that always DECLINES to slash (the opposite of the greedy bot default), runs
 * many turns, and asserts P1 never appears as a slash attacker in the log while every other seat
 * (still bot-controlled) does. This is the exact mechanism server.ts's HumanController plugs
 * into over WebSocket.
 */
async function testHumanControllerOverridesBot(): Promise<void> {
  const room = new Room(playerIds(8), seededRng(300));
  await room.pickGenerals();
  room.setController("P1", { chooseSlashTarget: async () => null });
  await room.runUntilGameOver(300);

  const p1Attacked = room.log.some((line) => line.startsWith("P1 slashes"));
  const someoneElseAttacked = room.log.some((line) => /^P[2-8] slashes/.test(line));
  strict.equal(p1Attacked, false, "P1's controller always declines to slash; it must never attack");
  strict.ok(someoneElseAttacked, "some other (still bot-controlled) seat must still attack normally");
  console.log(
    "PASS testHumanControllerOverridesBot: P1 never attacked (",
    room.turnNumber,
    "turns), other seats did",
  );
}

/**
 * Milestone 3.6 proof: the 4 new Controller hooks (wantsToEquip/wantsToPlayTrick/wantsToDodge/
 * wantsToUsePeach) are actually consulted and respected, not just type-checked. Installs a
 * controller on P1 that declines every one of them, runs many seeds, and asserts P1 never
 * equips/self-uses-a-trick/dodges/self-heals in the log -- while at least one other
 * (bot-controlled, always-accepts) seat does each of those same things, so the assertions aren't
 * vacuously true from nobody ever getting the opportunity.
 */
async function testExpandedControllerHooksRespected(): Promise<void> {
  const declineAll = {
    wantsToEquip: async () => false,
    wantsToPlayTrick: async () => false,
    chooseTrickTarget: async () => null,
    wantsToDodge: async () => false,
    wantsToUsePeach: async () => false,
  };
  let p1Equipped = false;
  let p1SelfTrickSourced = false;
  let p1Dodged = false;
  let p1Peached = false;
  let otherEquipped = false;
  let otherSelfTrickSourced = false;
  let otherDodged = false;
  let otherPeached = false;

  for (let seed = 400; seed < 440; seed++) {
    const room = new Room(playerIds(8), seededRng(seed));
    await room.pickGenerals();
    room.setController("P1", declineAll);
    await room.runUntilGameOver(300);
    for (const line of room.log) {
      if (/^P1 equips/.test(line)) p1Equipped = true;
      if (/^P1 (draws 2 cards \(ex nihilo\)|duels|uses savage assault|uses archery attack)/.test(line)) p1SelfTrickSourced = true;
      if (/^P1 dodges with jink/.test(line)) p1Dodged = true;
      if (/^P1 uses peach to recover/.test(line)) p1Peached = true;
      if (/^P[2-8] equips/.test(line)) otherEquipped = true;
      if (/^P[2-8] (draws 2 cards \(ex nihilo\)|duels|uses savage assault|uses archery attack)/.test(line)) otherSelfTrickSourced = true;
      if (/^P[2-8] dodges with jink/.test(line)) otherDodged = true;
      if (/^P[2-8] uses peach to recover/.test(line)) otherPeached = true;
    }
  }

  strict.equal(p1Equipped, false, "P1 declined every equip; it must never appear equipping");
  strict.equal(p1SelfTrickSourced, false, "P1 declined every trick; it must never appear as a trick source");
  strict.equal(p1Dodged, false, "P1 declined every dodge; it must never appear dodging with jink");
  strict.equal(p1Peached, false, "P1 declined every self-heal; it must never appear using peach");
  strict.ok(otherEquipped, "some bot-controlled seat must still equip normally");
  strict.ok(otherSelfTrickSourced, "some bot-controlled seat must still source a trick normally");
  strict.ok(otherDodged, "some bot-controlled seat must still dodge normally");
  strict.ok(otherPeached, "some bot-controlled seat must still self-heal with peach normally");
  console.log("PASS testExpandedControllerHooksRespected: P1 declined equip/trick/dodge/peach throughout; other seats did all 4 normally");
}

/**
 * Milestone 3.7 proof: chooseTrickTarget lets a controller pick WHICH player to target with
 * Dismantlement/Snatch/Duel, not just whether to play the card. Installs a controller on P1
 * that, whenever asked, always targets the LAST candidate in the list (an arbitrary but
 * deterministic choice distinguishable from the bot's random pick), and confirms the resulting
 * "P1 duels <that exact player>" log line matches across many seeds.
 */
async function testChooseTrickTargetPicksExactPlayer(): Promise<void> {
  let sawDuelWithChosenTarget = false;
  for (let seed = 500; seed < 540 && !sawDuelWithChosenTarget; seed++) {
    const room = new Room(playerIds(8), seededRng(seed));
    await room.pickGenerals();
    const lastChosenByKind = new Map<string, string>();
    room.setController("P1", {
      chooseTrickTarget: async (_player, kind, candidates) => {
        const chosen = candidates[candidates.length - 1];
        lastChosenByKind.set(kind, chosen.id);
        return chosen;
      },
    });
    await room.runUntilGameOver(300);
    const lastDuelChoice = lastChosenByKind.get("duel");
    if (lastDuelChoice && room.log.includes(`P1 duels ${lastDuelChoice}`)) {
      sawDuelWithChosenTarget = true;
    }
  }
  strict.ok(sawDuelWithChosenTarget, "chooseTrickTarget's exact chosen player never appeared as P1's duel target");
  console.log("PASS testChooseTrickTargetPicksExactPlayer: P1's controller-chosen Duel target matched the log exactly");
}

/**
 * Milestone 3.8 proof: wantsToPlaySlashInDuel and wantsToDiscardForGanglie are consulted, not
 * just type-checked. Installs a controller on P1 that always declines both, runs many seeds,
 * and asserts P1 never appears playing a Slash mid-Duel or discarding for Ganglie -- while some
 * other (bot, always-accepts) seat still does each normally.
 */
async function testDuelSlashAndGanglieDiscardRespected(): Promise<void> {
  let p1PlayedSlashInDuel = false;
  let p1DiscardedForGanglie = false;
  let otherPlayedSlashInDuel = false;
  let otherDiscardedForGanglie = false;

  for (let seed = 600; seed < 660; seed++) {
    const room = new Room(playerIds(8), seededRng(seed));
    await room.pickGenerals();
    room.setController("P1", {
      wantsToPlaySlashInDuel: async () => false,
      wantsToDiscardForGanglie: async () => false,
    });
    await room.runUntilGameOver(300);
    for (const line of room.log) {
      if (line === "P1 plays slash in the duel") p1PlayedSlashInDuel = true;
      if (line === "P1 discards 2 cards (ganglie)") p1DiscardedForGanglie = true;
      if (/^P[2-8] plays slash in the duel$/.test(line)) otherPlayedSlashInDuel = true;
      if (/^P[2-8] discards 2 cards \(ganglie\)$/.test(line)) otherDiscardedForGanglie = true;
    }
  }

  strict.equal(p1PlayedSlashInDuel, false, "P1 declined playing Slash in Duel; it must never appear doing so");
  strict.equal(p1DiscardedForGanglie, false, "P1 declined discarding for Ganglie; it must never appear doing so");
  strict.ok(otherPlayedSlashInDuel, "some bot-controlled seat must still play Slash in a Duel normally");
  strict.ok(otherDiscardedForGanglie, "some bot-controlled seat must still discard for Ganglie normally");
  console.log("PASS testDuelSlashAndGanglieDiscardRespected: P1 declined both throughout; other seats did both normally");
}

await testRoleDistribution();
await testPhaseCyclingConservesCards();
await testRebelKillsLord();
await testLordAndLoyalistWin();
await testCascadingDeathDoesNotOverwriteGameOver();
await testFreeformPlayLetsHumanChooseCardsAndPlayDuplicates();
await testEquipTriggersLiveUpdateCallback();
await testSlashTriggersLiveUpdateCallback();
await testFreeformPlayAOECardIsOfferedAndResolves();
await testAmazingGraceIsATurnOrderDraft();
await testDiscardChoiceLetsHumanPickWhichCards();
await testDrawPhaseAsksBeforeDrawing();
await testEmergentCombatReachesWinCondition();
await testEquipAndTricksAppearInPlay();
await testGeneralSkillsAppearInPlay();
testKongchengImmunity();
testQianxunImmunity();
testQicaiIgnoresSnatchDistance();
testMashuReducesDistance();
await testSavageAssaultAvoidImmunity();
await testSavageAssaultAndArcheryAttackAreAChoice();
await testTieqiBlocksDodge();
await testViewAsJinkDodges();
await testLiegongBlocksJink();
await testWushuangRequiresTwoJinks();
await testKurouSelfInflictedDeathCreditsNoKiller();
await testHumanControllerOverridesBot();
await testExpandedControllerHooksRespected();
await testChooseTrickTargetPicksExactPlayer();
await testDuelSlashAndGanglieDiscardRespected();
console.log("\nAll Milestone 0-3.9 smoke tests passed.");
