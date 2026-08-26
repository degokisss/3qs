// Milestone 3.5-3.8: pluggable per-player decision-making. Room asks a player's Controller for
// each decision instead of always running the greedy bot policy inline -- this is what lets a
// human take over a seat over WebSocket (server.ts's HumanController) while every other seat
// keeps using the existing bot policy, with NO change to Room's resolution logic itself.
//
// Covered so far: Slash target, target for the 3 single-target tricks (Dismantlement/Snatch/
// Duel), whether to play a held AOE/self trick (SavageAssault/ArcheryAttack/GodSalvation/
// AmazingGrace/ExNihilo -- these have no target to pick, just a yes/no), whether to equip a held
// Weapon/Horse, whether to dodge an incoming Slash with a held Jink, whether to self-rescue with
// a held Peach while dying, whether to play a held Slash when responding in a Duel, whether to
// discard 2 (vs. take 1 damage) for Ganglie. Milestone 5: full free-hand Play phase -- see
// `chooseFreeAction` below -- a human-only opt-in that hands the whole Play phase over to an
// interactive "pick any legal card/action, any order, until you end the phase" loop (room.ts's
// `runFreeformPlayPhase`), reusing every target-selection method above unchanged. Bots never
// define it and keep using the original fixed-order automatic pass (room.ts's `runPlayPhase`
// fallback branch).

import { Card, CardKind } from "./card.js";
import { GamePlayer } from "./player.js";
import { GeneralDef } from "./skill.js";
import { effectiveDistance, isImmuneToSlashAndDuel } from "./combat.js";

/** One legal thing a player could do right now during a freeform Play phase, computed fresh by
 *  `Room.computeLegalActions` before each `chooseFreeAction` ask. `playCard`'s `cardKind` is
 *  what the card resolves AS (viewAs-aware, e.g. a red card played as Slash via Wusheng), not
 *  necessarily the card's own real kind. */
export type FreeAction =
  | { kind: "equip"; cardId: number }
  | { kind: "playCard"; cardId: number; cardKind: CardKind }
  | { kind: "selfAction"; skillName: string }
  | { kind: "activeAction"; skillName: string };

/** Alive players `actor` could legally Slash: not self, within `actor.attackRange`, not immune (Kongcheng). */
export function slashCandidates(alive: GamePlayer[], actor: GamePlayer): GamePlayer[] {
  return alive.filter(
    (p) => p !== actor && effectiveDistance(alive, actor, p) <= actor.attackRange && !isImmuneToSlashAndDuel(p),
  );
}

export interface Controller {
  /** Milestone 6: `candidates` is always non-empty (never returns null -- every player must end
   *  up with a general; Room falls back to `candidates[0]` if this somehow returns a falsy value). */
  chooseGeneral(candidates: GeneralDef[]): Promise<GeneralDef>;
  /** `candidates` is always non-empty (Room checks first). Return null to decline/pass. */
  chooseSlashTarget(actor: GamePlayer, candidates: GamePlayer[]): Promise<GamePlayer | null>;
  /** Room already confirmed `card` is a legal Weapon/Horse to equip right now. */
  wantsToEquip(player: GamePlayer, card: Card): Promise<boolean>;
  /** Dismantlement/Snatch/Duel: `candidates` is always non-empty. Return null to decline. */
  chooseTrickTarget(player: GamePlayer, kind: CardKind, candidates: GamePlayer[]): Promise<GamePlayer | null>;
  /** SavageAssault/ArcheryAttack/GodSalvation/AmazingGrace/ExNihilo: no target to pick, just yes/no. */
  wantsToPlayTrick(player: GamePlayer, kind: CardKind): Promise<boolean>;
  /** `player` holds a Jink and is the target of an incoming Slash. */
  wantsToDodge(player: GamePlayer): Promise<boolean>;
  /** `player` holds a Peach and is at 0 hp (or below) right now. */
  wantsToUsePeach(player: GamePlayer): Promise<boolean>;
  /** `rescuer` holds a Peach and another player is dying right now -- spend it to save THEM
   *  instead of self? Only called when `rescuer` actually holds one. */
  wantsToUsePeachForOther(rescuer: GamePlayer, dyingPlayer: GamePlayer): Promise<boolean>;
  /** Play phase: `player` is wounded and holds a Peach -- play it proactively (not while dying)
   *  to heal 1 hp right now? Real Sanguosha lets this repeat as long as still wounded and still
   *  holding one, no once-per-turn cap (only Slash has an explicit limit). */
  wantsToUsePeachSelfHeal(player: GamePlayer): Promise<boolean>;
  /** Play phase: `player` holds an Analeptic -- play it proactively to arm a +1 damage bonus
   *  for their next Slash this turn? Only called when they hold one; no wounded-state gate
   *  (unlike Peach self-heal, this is a pure offense buff, useful regardless of hp). */
  wantsToUseAnalepticBuff(player: GamePlayer): Promise<boolean>;
  /** `player` holds a Slash and must decide whether to play it to continue a Duel exchange. */
  wantsToPlaySlashInDuel(player: GamePlayer): Promise<boolean>;
  /** `player` (the source of damage to a Ganglie holder) has >=2 cards and can choose to discard
   *  2 instead of taking 1 damage. */
  wantsToDiscardForGanglie(player: GamePlayer): Promise<boolean>;
  /** `player` holds a Slash and was hit by Savage Assault -- discard it (vs. take 1 damage)? */
  wantsToDiscardForSavageAssault(player: GamePlayer): Promise<boolean>;
  /** `player` holds a Jink and was hit by Archery Attack -- discard it (vs. take 1 damage)? */
  wantsToDiscardForArcheryAttack(player: GamePlayer): Promise<boolean>;
  /** Amazing Grace: `player`'s turn to take exactly one card from the still-face-up
   *  `candidates` pool (never empty when asked). */
  choosePickCard(player: GamePlayer, candidates: Card[]): Promise<Card>;
  /** Dismantlement/Snatch: `player` chooses exactly one of `owner`'s cards (hand or equipped)
   *  to take/discard, instead of a random pick -- `candidates` is always non-empty when asked. */
  choosePlayerCard(player: GamePlayer, owner: GamePlayer, candidates: Card[]): Promise<Card>;
  /** End-of-turn Discard phase: `player`'s hand exceeds their card limit by exactly `count`.
   *  Return exactly `count` distinct cards currently in `player.hand` to discard. Room falls
   *  back to the first `count` held cards if this returns something invalid (wrong length, or
   *  cards not actually held) -- covers a misbehaving or timed-out controller. */
  chooseDiscards(player: GamePlayer, count: number): Promise<Card[]>;
  /** `player` may use `skillName`'s proactive self action (e.g. Kurou) right now; no target to pick. */
  wantsToUseSelfAction(player: GamePlayer, skillName: string): Promise<boolean>;
  /** Generic single-target picker with no built-in filter -- `candidates` is pre-filtered by
   *  the caller. Return null to decline. */
  chooseAnyPlayerTarget(player: GamePlayer, candidates: GamePlayer[]): Promise<GamePlayer | null>;
  /** Draw phase: `player` is about to draw `count` cards from the pile. Resolves once they've
   *  confirmed (e.g. clicked the face-down draw pile) -- lets a human seat draw on their own
   *  timing instead of cards silently appearing in hand. Bots resolve immediately. */
  wantsToDrawNow(player: GamePlayer, count: number): Promise<void>;
  /** If defined (only ever set for a human-controlled seat -- see server.ts's HumanController),
   *  Room hands the ENTIRE Play phase over to `runFreeformPlayPhase` instead of the fixed
   *  automatic pass below: called repeatedly with the full current legal-action list, resolves
   *  whichever one is chosen, and loops until this returns `null` (end phase) or nothing is
   *  legal any more. Left undefined by `makeBotController` -- bots always keep using the
   *  original fixed-order pass, byte-for-byte unchanged. */
  chooseFreeAction?(player: GamePlayer, legalActions: FreeAction[]): Promise<FreeAction | null>;
}

/** The naive greedy policy every seat used before human control existed: always act when legal. */
export function makeBotController(rng: () => number): Controller {
  const pickRandom = (candidates: GamePlayer[]): GamePlayer | null =>
    candidates.length ? candidates[Math.floor(rng() * candidates.length)] : null;
  return {
    async chooseGeneral(candidates) {
      return candidates[Math.floor(rng() * candidates.length)];
    },
    async chooseSlashTarget(_actor, candidates) {
      return pickRandom(candidates);
    },
    async wantsToEquip() {
      return true;
    },
    async chooseTrickTarget(_player, _kind, candidates) {
      return pickRandom(candidates);
    },
    async wantsToPlayTrick() {
      return true;
    },
    async wantsToDodge() {
      return true;
    },
    async wantsToUsePeach() {
      return true;
    },
    async wantsToUsePeachForOther() {
      return false; // ally-rescue is a genuinely strategic (role-aware) decision this simple
      // greedy bot policy doesn't model -- unlike every other ask above, spending a card here
      // helps someone ELSE, not the bot itself, so it declines by default (a claimed human seat
      // gets the real choice instead, see server.ts's askClient wiring)
    },
    async wantsToUsePeachSelfHeal() {
      return false; // matches the pre-existing bot behavior: the fixed pass never proactively
      // burns a Peach outside a real dying emergency (see room.ts's runPlayPhase)
    },
    async wantsToUseAnalepticBuff() {
      return false; // matches wantsToUsePeachSelfHeal's reasoning: the fixed pass never
      // proactively burns Peach/Analeptic outside a real dying emergency
    },
    async wantsToPlaySlashInDuel() {
      return true;
    },
    async wantsToDiscardForGanglie() {
      return true; // matches the pre-3.8 unconditional-discard-when-possible behavior
    },
    async wantsToDiscardForSavageAssault() {
      return true; // matches the greedy policy's other card-preservation defaults
    },
    async wantsToDiscardForArcheryAttack() {
      return true;
    },
    async choosePickCard(_player, candidates) {
      return candidates[0]; // matches the greedy policy's other no-preference defaults
    },
    async choosePlayerCard(_player, _owner, candidates) {
      // Prefer a known equip card over a blind random hand card -- a visible, usually-valuable
      // resource is worth denying/taking over an unseen one, matching this policy's other
      // "known/valuable resource" preferences (e.g. wantsToDiscardForGanglie).
      return candidates.find((c) => c.kind === CardKind.Weapon || c.kind === CardKind.Horse) ?? candidates[0];
    },
    async chooseDiscards(player, count) {
      return player.hand.slice(0, count); // matches the greedy policy's other no-preference defaults
    },
    async wantsToUseSelfAction() {
      return true;
    },
    async chooseAnyPlayerTarget(_player, candidates) {
      return pickRandom(candidates);
    },
    async wantsToDrawNow() {
      // bots draw immediately, no pause
    },
  };
}
