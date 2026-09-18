// Authoritative game-state container. Structurally mirrors src/server/room.cpp (Room) +
// src/server/gamerule.cpp (GameRule::onPhaseProceed) for the parts implemented so far:
// per-player phase cycling, draw-pile/discard-pile card flow, death -> win-condition checks,
// and (Indulgence only, for Guojia's Tiandu) delayed-trick judge-area resolution. Armors and
// several other subsystems are still out of scope -- see webport/README.md roadmap.

import { Card, CardKind, Suit, buildStandardDeck, shuffle } from "./card.js";
import { GamePlayer } from "./player.js";
import { GameMode, Phase, PHASE_ORDER, Role } from "./types.js";
import {
  assignHegemonyFaction,
  assignRoles,
  checkHegemonyWinCondition,
  checkWinCondition,
  combineHegemonyHp,
  factionLabelVI,
  isCompanionPair,
  ROLE_LABEL_VI,
  WinResult,
} from "./gamerule.js";
import {
  EngineContext,
  KnownBothOption,
  PrivateReveal,
  allDismantlementLikeCards,
  allDuelLikeCards,
  allFireAttackLikeCards,
  allIndulgenceLikeCards,
  allSlashLikeCards,
  allSupplyShortageLikeCards,
  findDismantlementLikeCard,
  findDuelLikeCard,
  findFireAttackLikeCard,
  findIndulgenceLikeCard,
  findSlashLikeCard,
  findSupplyShortageLikeCard,
  heal,
  resolveSlash,
  resolveSlashBonusTarget,
} from "./combat.js";
import { GENERALS, GeneralDef, SKILLS, routeDiscard } from "./skill.js";
import { Controller, FreeAction, makeBotController, pickLeastImportantCards, slashCandidates } from "./controller.js";
import {
  attachIndulgence,
  attachLightning,
  attachSupplyShortage,
  awaitExhaustedCandidates,
  befriendAttackingCandidates,
  collateralCandidates,
  dismantlementCandidates,
  duelCandidates,
  fireAttackCandidates,
  indulgenceCandidates,
  ironChainCandidates,
  knownBothCandidates,
  lightningCandidates,
  resolveAmazingGrace,
  resolveAnalepticBuff,
  resolveArcheryAttack,
  resolveAwaitExhausted,
  resolveBefriendAttacking,
  resolveCollateral,
  resolveDismantlement,
  resolveDuel,
  resolveExNihilo,
  resolveFireAttack,
  resolveGodSalvation,
  resolveIndulgenceJudgment,
  resolveIronChain,
  resolveKnownBoth,
  resolveLightningJudgment,
  resolvePeachSelfHeal,
  resolveSavageAssault,
  resolveSnatch,
  resolveSupplyShortageJudgment,
  snatchCandidates,
  supplyShortageCandidates,
} from "./trick.js";

// Vietnamese labels for the trick kinds tryPlayTargeted's viewAs/weimu-immune log lines embed --
// mirrors the client's own TRICK_LABEL (public/index.html); Dismantlement/Snatch/Duel/
// Indulgence are the only entries needed here (the only trick kinds any tryPlay* method embeds
// a label for).
const TRICK_LABEL_VI: Partial<Record<CardKind, string>> = {
  [CardKind.Dismantlement]: "Quá Hạ Sách Kiều",
  [CardKind.Snatch]: "Thuận Thủ Khiên Dương",
  [CardKind.Duel]: "Quyết Đấu",
  [CardKind.Indulgence]: "Lạc Bất Tư Thục",
  [CardKind.SupplyShortage]: "Binh Lương Thốn Đoạn",
  [CardKind.FireAttack]: "Hỏa Công",
  [CardKind.Lightning]: "Thiểm Điện",
  [CardKind.Collateral]: "Tá Đao Sát Nhân",
  [CardKind.BefriendAttacking]: "Viễn Giao Cận Công",
  [CardKind.AwaitExhausted]: "Dĩ Dật Đãi Lao",
  [CardKind.IronChain]: "Thiết Tác Liên Hoàn",
  [CardKind.SavageAssault]: "Nam Man Nhập Xâm",
  [CardKind.ArcheryAttack]: "Vạn Tiễn Tề Phát",
  [CardKind.KnownBoth]: "Tri Bỉ Tri Kỉ",
};

export class Room {
  readonly mode: GameMode;
  readonly players: GamePlayer[];
  drawPile: Card[];
  discardPile: Card[] = [];
  currentIndex = 0;
  turnNumber = 0;
  gameOver: WinResult = null;
  /** Hegemony mode only (Milestone 23 addendum "Ao Chiến"/鏖战, see gamerule.ts's Hegemony
   *  header): latches true once ≤4 players remain and every one of them is on a distinct
   *  faction (checked after every death -- see `checkAoChienTrigger`), and never resets. */
  aoChienActive = false;
  /** Hegemony mode only: the running per-kingdom team-size tally + the official quota
   *  (floor(playerCount/2)) `assignHegemonyFaction` needs -- moved to Room-instance fields (was
   *  a `pickGenerals`-local variable before the reveal-TIMING addendum) since faction is now
   *  assigned at REVEAL time (`runHegemonyReveal`), which can happen any time during play, not
   *  just during the draft loop. Set once in the constructor, mutated in place thereafter. */
  private readonly hegemonyKingdomCounts: Record<string, number> = {};
  private readonly hegemonyKingdomQuota: number;
  readonly log: string[] = [];
  private readonly rng: () => number;
  private readonly controllers = new Map<string, Controller>();
  private readonly takenGenerals = new Set<string>(); // general names already picked this game -- excluded from future candidate pools
  /** Non-null only while `pickGenerals()` is running: the player whose turn it currently is to
   *  pick a general. Exposed so server.ts can broadcast "whose turn" during selection. */
  pickTurnPlayerId: string | null = null;
  /** Fired right after an equip resolves (weapon/horse) -- see `setLiveUpdateCallback`. */
  private onLiveUpdate: (() => void) | null = null;
  /** KnownBoth's private-reveal delivery hook (Milestone 31) -- see `setPrivateRevealCallback`. */
  private onPrivateReveal: ((viewerId: string, reveal: PrivateReveal) => void) | null = null;
  /** Fangquan (Liushan): players queued for an immediate extra turn, consumed before the
   *  normal seat rotation (`currentIndex`) resumes -- see `playTurn()`. */
  private extraTurnQueue: GamePlayer[] = [];

  constructor(playerIds: string[], rng: () => number = Math.random, mode: GameMode = GameMode.Identity) {
    // Identity mode's role table (gamerule.ts's ROLE_COUNTS) only covers 5-10 players. Hegemony
    // mode has no such table (kingdom teams scale with `hegemonyKingdomQuota` below, computed
    // for any size) and the real 国战 rule is commonly played up to 12 -- so it gets a higher
    // ceiling than Identity mode.
    const maxPlayers = mode === GameMode.Hegemony ? 12 : 10;
    if (playerIds.length < 5 || playerIds.length > maxPlayers) {
      throw new Error(
        mode === GameMode.Hegemony ? "Hegemony mode supports 5-12 players" : "Identity mode supports 5-10 players",
      );
    }
    this.mode = mode;
    this.hegemonyKingdomQuota = Math.floor(playerIds.length / 2);
    this.players = playerIds.map((id) => new GamePlayer(id));
    // Hegemony mode has no Lord/Loyalist/Rebel/Renegade -- kingdom teams are assigned per-player
    // as each one picks a general (see pickGenerals()'s Hegemony branch below), not up front.
    if (mode === GameMode.Identity) assignRoles(this.players, rng);
    this.players.forEach((p, i) => (p.seat = i + 1));

    this.rng = rng;
    // Generals are NOT assigned here any more -- see pickGenerals() below (Milestone 6: turn-based
    // selection from 3 candidates, starting with the lord). drawPile is still built now (doesn't
    // depend on any general); initial hands are dealt at the end of pickGenerals() once every
    // player's maxHp is finally known.
    this.drawPile = shuffle(buildStandardDeck(), rng);

    // Room::adjustSeats: turn order (both general-picking and Play-phase turns) starts with the
    // lord in Identity mode; Hegemony mode has no lord, so it starts with a random seat instead.
    this.currentIndex =
      mode === GameMode.Identity ? this.players.findIndex((p) => p.role === Role.Lord) : Math.floor(rng() * this.players.length);

    for (const player of this.players) this.controllers.set(player.id, makeBotController(rng));
  }

  /** Deals `count` distinct, not-yet-taken candidate generals (Milestone 6). Fewer than `count`
   *  only if the pool is nearly exhausted (60 generals / up to 12 Hegemony players -- never
   *  actually hits this in practice, but degrades gracefully instead of throwing). `kingdom`, if
   *  given (Hegemony mode's deputy pick, see `pickGenerals`), restricts the pool to that kingdom
   *  first -- real Hegemony requires both generals of a pair to share one kingdom. Falls back
   *  to the full remaining pool if that kingdom's own pool is exhausted (a real possibility once
   *  several players have already drafted 2 generals each from a small kingdom -- degrades
   *  gracefully rather than ever leaving a player with zero deputy candidates). */
  private candidateGenerals(count: number, kingdom?: string, pool?: GeneralDef[]): GeneralDef[] {
    let remaining = pool ? [...pool] : GENERALS.filter((g) => !this.takenGenerals.has(g.name));
    if (kingdom) {
      const sameKingdom = remaining.filter((g) => g.kingdom === kingdom);
      if (sameKingdom.length > 0) remaining = sameKingdom;
    }
    const picks: GeneralDef[] = [];
    for (let i = 0; i < count && remaining.length > 0; i++) {
      const idx = Math.floor(this.rng() * remaining.length);
      picks.push(remaining[idx]);
      remaining.splice(idx, 1);
    }
    return picks;
  }

  /**
   * Milestone 6: turn-based general selection. Starting with the lord (Identity mode) or a
   * random seat (Hegemony mode, see the constructor) and proceeding around the table in seat
   * order (the same order Play-phase turns use), each player is dealt 3 not-yet-taken candidate
   * generals and picks one via their Controller's `chooseGeneral` -- bots (the default policy)
   * pick immediately with no ask; a claimed human seat is asked over WebSocket (server.ts's
   * HumanController). `onStep`, if given, fires once before each ask (so the caller can
   * broadcast "whose turn now") and once after each assignment (so it can broadcast the
   * result), plus a final time once hands are dealt. MUST complete before `playTurn()` is ever
   * called -- see the guard there.
   *
   * Hegemony mode drafts 2 generals per player from 5 dealt candidates (the real 国战 "phát 5,
   * chọn 2" rule): all 5 are dealt UNFILTERED (any kingdom) via one `candidateGenerals(5)` call,
   * the player picks their main general from those 5, then picks their deputy from the 4 that
   * remain -- filtered down to the main's own kingdom first (real Hegemony requires both
   * generals of a pair to share one kingdom; falls back to all 4 if none of them happen to share
   * it, an edge case `candidateGenerals`'s kingdom filter already degrades gracefully for). The
   * 3 (or more, if the kingdom filter empties out) generals never picked are NOT added to
   * `takenGenerals`, so they go back into the shared pool for later players, matching the real
   * rule's "trả lại" behavior. Stats combine via `combineHegemonyHp` + skill union, and
   * `player.general`/`generalName` are only assigned once BOTH picks land (so the room-wide
   * `pickingGenerals` flag -- driven by `!p.general` -- stays accurate while a player's deputy
   * pick is still pending). `faction`/`isAmbitionist` are NOT assigned here any more (Milestone
   * 23's reveal-TIMING addendum): both generals start hidden (`mainRevealed`/`deputyRevealed`
   * default false), and kingdom -- so also `faction` -- only becomes known the first time either
   * one is revealed (`runHegemonyReveal`, `Phase.RoundStart`). The draft log line therefore
   * never names which general or kingdom was picked.
   */
  async pickGenerals(onStep?: () => void): Promise<void> {
    // Standard rule: the lord's identity is public knowledge once the match begins -- but not
    // before, while the room still sits in the lobby/waiting-room (see gamerule.ts assignRoles).
    // No-op in Hegemony mode: `role` is never assigned there, so this never matches.
    const lord = this.players.find((p) => p.role === Role.Lord);
    if (lord) lord.roleShown = true;
    const n = this.players.length;

    for (let step = 0; step < n; step++) {
      const player = this.players[(this.currentIndex + step) % n];
      this.pickTurnPlayerId = player.id;
      const controller = this.controllers.get(player.id)!;
      if (this.mode === GameMode.Hegemony) {
        onStep?.();
        const dealt = this.candidateGenerals(5);
        const main = (await controller.chooseGeneral(dealt, "main")) ?? dealt[0];
        this.takenGenerals.add(main.name);
        onStep?.();
        const remaining = dealt.filter((g) => g.name !== main.name);
        const deputyCandidates = this.candidateGenerals(remaining.length, main.kingdom, remaining);
        const deputy = (await controller.chooseGeneral(deputyCandidates, "deputy")) ?? deputyCandidates[0];
        this.takenGenerals.add(deputy.name);

        player.general = main.name;
        player.generalName = main.displayName;
        player.deputyGeneral = deputy.name;
        player.deputyGeneralName = deputy.displayName;
        player.kingdom = main.kingdom;
        player.gender = main.gender ?? "male"; // real rule: main general determines gender once both are shown
        player.skills = [...main.skillNames, ...deputy.skillNames].map((s) => SKILLS[s]);
        player.mainSkillCount = main.skillNames.length;
        player.maxHp = combineHegemonyHp(main.maxHp, deputy.maxHp).maxHp;
        player.hp = player.maxHp;
        // The leftover-half bonus draw (if any) is resolved later, alongside the companion
        // bonus, the instant this player's SECOND general reveals -- see `runHegemonyReveal`.

        // Both generals stay face-down -- no kingdom/name leak in the shared log (see this
        // method's header). `runHegemonyReveal` assigns faction/Ambitionist once revealed.
        this.log.push(`${player.id} đã chọn xong 2 tướng (ẩn cho đến khi lộ diện)`);
        onStep?.();
      } else {
        onStep?.();
        const candidates = this.candidateGenerals(3);
        const chosen = (await controller.chooseGeneral(candidates)) ?? candidates[0];
        this.takenGenerals.add(chosen.name);
        player.general = chosen.name;
        player.generalName = chosen.displayName;
        player.kingdom = chosen.kingdom;
        player.gender = chosen.gender ?? "male";
        player.skills = chosen.skillNames.map((s) => SKILLS[s]);
        player.maxHp = chosen.maxHp;
        player.hp = chosen.maxHp;
        this.log.push(`${player.id} chọn tướng ${chosen.displayName}`);
        onStep?.();
      }
    }
    this.pickTurnPlayerId = null;
    for (const player of this.players) {
      player.hand = this.drawPile.splice(0, player.maxHp); // initial hand size == max hp
    }
    // Hegemony's summary omits names (see method header); Identity's still names generals since
    // those were never hidden to begin with.
    this.log.push(
      this.mode === GameMode.Hegemony
        ? "Bắt đầu ván đấu: mọi tướng đều ẩn, sẽ lộ diện dần khi từng người vào lượt của mình"
        : `Bắt đầu ván đấu: ${this.players.map((p) => `${p.id}=${factionLabelVI(this.mode, p)}/${p.generalName}`).join(", ")}`,
    );
    onStep?.();
  }

  /** Swaps in a custom decision-maker for one seat (e.g. a human over WebSocket). Only the given
   *  methods are overridden; anything omitted still falls back to the bot policy. `null` reverts
   *  the seat fully to bot. */
  setController(playerId: string, controller: Partial<Controller> | null): void {
    this.controllers.set(
      playerId,
      controller ? { ...makeBotController(this.rng), ...controller } : makeBotController(this.rng),
    );
  }

  private drawOne(): Card | null {
    if (this.drawPile.length === 0) {
      // Room::getCardFromPile -> swapPile(): reshuffle discard pile back into the draw pile.
      // Mutated IN PLACE (never reassigned) -- `makeContext()` snapshots `discardPile:
      // this.discardPile` as a plain array REFERENCE once per call, and that same reference is
      // held for the rest of whatever resolution is in flight (e.g. `judge()` calling
      // `ctx.drawTop()` -- which reaches here -- then `disposeJudgmentCard`/
      // `resolveSupplyShortageJudgment` pushing onto that SAME `ctx.discardPile` afterward). A
      // naive `this.discardPile = []` reassignment here orphans any such in-flight reference:
      // every card later pushed through it lands in a detached array nobody else can see,
      // silently vanishing from the game forever. Real bug, found by Milestone 26's
      // card-conservation regression test (seed 1, turn 13: a SupplyShortage Judge-phase
      // judgment drew the pile's last card, triggering a reshuffle mid-resolution, losing both
      // the judgment card and the delayed-trick card itself -- 87 cards counted instead of 89).
      const reshuffled = shuffle(this.discardPile, this.rng);
      this.discardPile.length = 0;
      this.drawPile.push(...reshuffled);
      if (this.drawPile.length === 0) return null; // both piles exhausted
    }
    return this.drawPile.pop()!;
  }

  /** Guanxing support: peeks the top `n` cards of the draw pile without removing them, in draw
   *  order (index 0 would be drawn next). See EngineContext.peekTop's doc comment for the "no
   *  forced reshuffle" simplification. */
  private peekTop(n: number): Card[] {
    const count = Math.min(n, this.drawPile.length);
    return this.drawPile.slice(this.drawPile.length - count).reverse();
  }

  /** Guanxing support: re-stacks the exact cards a prior `peekTop` call returned -- see
   *  EngineContext.arrangeTop's doc comment for `top`/`bottom` order semantics. */
  private arrangeTop(top: Card[], bottom: Card[]): void {
    const n = top.length + bottom.length;
    this.drawPile.splice(this.drawPile.length - n, n);
    this.drawPile = [...bottom.slice().reverse(), ...this.drawPile, ...top.slice().reverse()];
  }

  private drawCards(player: GamePlayer, n: number): void {
    for (let i = 0; i < n; i++) {
      const c = this.drawOne();
      if (!c) return;
      player.hand.push(c);
    }
  }

  private async discardDownToLimit(player: GamePlayer): Promise<void> {
    if (player.skills.some((s) => s.skipsDiscardPhase?.(player))) {
      this.log.push(`${player.id} bỏ qua giai đoạn Bỏ bài (keji)`);
      return;
    }
    const over = player.handcardNum - player.maxCards;
    if (over <= 0) return;
    const chosen = await this.controllers.get(player.id)!.chooseDiscards(player, over);
    // Validate: exactly `over` DISTINCT cards actually still in hand right now -- covers a
    // misbehaving or timed-out controller by falling back to pickLeastImportantCards instead of
    // ever discarding the wrong count.
    const distinctHeld = [...new Set(chosen)].filter((c) => player.hand.includes(c));
    const discarded = distinctHeld.length === over ? distinctHeld : pickLeastImportantCards(player.hand, over);
    for (const c of discarded) player.hand.splice(player.hand.indexOf(c), 1);
    const ctx = this.makeContext(this.players.filter((p) => p.alive));
    for (const c of discarded) await routeDiscard(ctx, player, c);
    this.log.push(`${player.id} bỏ ${discarded.length} lá bài (giới hạn bài ${player.maxCards})`);

    // Guzheng (Erzhang): every OTHER alive player may claim one of these discarded cards --
    // only cards that actually landed in the discard pile (Lirang may have redirected some
    // straight to another player's hand instead, never touching the pile at all).
    const actuallyDiscarded = discarded.filter((c) => this.discardPile.includes(c));
    for (const p of this.players.filter((p) => p.alive && p !== player)) {
      for (const skill of p.skills) {
        await skill.onOtherPlayerOverDiscard?.(ctx, p, player, actuallyDiscarded, this.rng);
      }
    }
    this.onLiveUpdate?.();
  }

  /** Test/debug-only hook until a scripted-damage test needs the real hook pipeline: applies
   *  damage directly, bypassing EngineContext (no onDamage/onDamageDealt/reduceDamage triggers).
   *  No killer credited -- matches loseHp's own "self-inflicted, credits nobody" shape, since
   *  the win condition no longer needs a credited role (see gamerule.ts's checkWinCondition)
   *  and kill-reward/punish logic needs a real killer player, never just a role. */
  async damagePlayer(targetId: string, amount: number): Promise<void> {
    const target = this.players.find((p) => p.id === targetId);
    if (!target || !target.alive) return;
    target.hp -= amount;
    this.log.push(`${target.id} chịu ${amount} sát thương (máu ${target.hp}/${target.maxHp})`);
    if (target.hp <= 0) await this.killPlayer(target);
  }

  private async killPlayer(player: GamePlayer, killer?: GamePlayer): Promise<void> {
    player.alive = false;
    player.roleShown = true; // Player death always reveals role (BuryVictim)
    // Hegemony: death always reveals BOTH generals too (same "BuryVictim" principle), even if
    // the player never chose to during play -- assigns faction/Ambitionist right here if they
    // died still fully hidden, so the win-check right below sees a determined force for them.
    if (this.mode === GameMode.Hegemony && (!player.mainRevealed || !player.deputyRevealed)) {
      const wasHidden = player.faction === "";
      player.mainRevealed = true;
      player.deputyRevealed = true;
      if (wasHidden) {
        const { faction, isAmbitionist } = assignHegemonyFaction(player.id, player.kingdom, this.hegemonyKingdomCounts, this.hegemonyKingdomQuota);
        player.faction = faction;
        player.isAmbitionist = isAmbitionist;
      }
    }

    // Standard rule: killing a Rebel rewards the killer with 3 cards, regardless of the
    // killer's own role. Only fires when we know the specific killer (the real combat pipeline
    // always does; Room.damagePlayer's test-only scripted-damage bypass only has a role to
    // credit, not a specific player, so this reward doesn't apply there). Identity mode only --
    // Hegemony's `role` is never assigned (see the constructor), so this would never fire there
    // even unguarded, but the explicit mode check documents that rather than relying on it.
    if (this.mode === GameMode.Identity && killer?.alive && player.role === Role.Rebel) {
      this.drawCards(killer, 3);
      this.log.push(`${killer.id} giết phản tặc ${player.id}, rút 3 lá`);
    }

    // Standard rule: if the Lord kills a Loyalist (friendly fire), the Lord discards their
    // entire hand and all equipped cards as punishment. Identity mode only, same reasoning as
    // the Rebel-kill reward above.
    if (this.mode === GameMode.Identity && killer?.alive && killer.role === Role.Lord && player.role === Role.Loyalist) {
      const punishedLord: GamePlayer = killer;
      const equipsLost = [punishedLord.weapon, punishedLord.defenseHorse, punishedLord.offenseHorse].filter((c): c is Card => c !== null);
      if (punishedLord.hand.length > 0 || equipsLost.length > 0) {
        this.discardPile.push(...punishedLord.hand, ...equipsLost);
        punishedLord.hand = [];
        punishedLord.weapon = null;
        punishedLord.defenseHorse = null;
        punishedLord.offenseHorse = null;
        this.log.push(`${punishedLord.id} (chủ công) giết nhầm trung thần ${player.id}, mất hết bài trên tay và trang bị`);
        // Xiaoji (Sunshangxiang): draws 2 for each equip of hers that leaves the zone --
        // fires once per card lost, matching equip()'s per-card trigger elsewhere.
        const equipCtx = this.makeContext(this.players.filter((p) => p.alive));
        for (let i = 0; i < equipsLost.length; i++) {
          for (const skill of punishedLord.skills) await skill.onEquipLost?.(equipCtx, punishedLord);
        }
      }
    }

    // Xingshang (Caopi): claims the dead player's hand instead of it going to the discard pile.
    // Automatic (no ask) -- see skill.ts header for why several optional invokes are simplified.
    const claimant = this.players.find((p) => p.alive && p !== player && p.skills.some((s) => s.claimsDeathCards));
    if (claimant && player.hand.length > 0) {
      claimant.hand.push(...player.hand);
      this.log.push(`${claimant.id} nhận toàn bộ bài của ${player.id} (xingshang)`);
    } else {
      this.discardPile.push(...player.hand);
    }
    player.hand = [];
    this.log.push(`${player.id} (${factionLabelVI(this.mode, player)}) qua đời`);

    if (!this.gameOver) {
      if (this.mode === GameMode.Hegemony) {
        this.checkHegemonyGameEnd();
      } else {
        const result = checkWinCondition(this.players);
        if (result) {
          this.gameOver = result;
          const label = result.winners.map((r) => ROLE_LABEL_VI[r as Role]).join(" + ");
          this.log.push(`Kết thúc ván: ${label} thắng`);
          // Real Sanguosha reveals EVERY identity once the match ends, not just the dead/lord --
          // survivors' roles were only fogged during play (Player::hasShownRole).
          for (const p of this.players) p.roleShown = true;
        }
      }
    }

    // Suishi (Tianfeng): every alive ally of the dead player loses 1 hp.
    const ctx = this.makeContext(this.players.filter((p) => p.alive));
    for (const p of ctx.alivePlayers) {
      for (const skill of p.skills) await skill.onAllyDeath?.(ctx, p, player, this.rng);
    }
  }

  /** Hegemony "Ao Chiến"/鏖战 trigger (Milestone 23 addendum) -- checked after every death that
   *  doesn't already end the game. Official condition: ≤4 players remain and no faction has
   *  more than 1 living member. A still-hidden (unrevealed) player counts as their OWN distinct
   *  faction for THIS specific check (confirmed live: "暗置武将也算不同势力（暗置与暗置武将间也是如
   *  此）") -- unlike `checkHegemonyWinCondition`, which can't assess victory at all while
   *  anyone's still hidden, so it needs no such substitution. Latches permanently once true. */
  private checkAoChienTrigger(): void {
    const alive = this.players.filter((p) => p.alive);
    if (alive.length > 4) return;
    const effectiveFaction = (p: GamePlayer) => p.faction || `hidden:${p.id}`;
    const everyoneDistinct = alive.every((p) => alive.filter((q) => effectiveFaction(q) === effectiveFaction(p)).length === 1);
    if (!everyoneDistinct) return;
    this.aoChienActive = true;
    this.log.push("Ao Chiến bắt đầu: từ giờ Đào không còn tác dụng hồi máu (chỉ có thể bỏ đi)");
  }

  /** Hegemony reveal-TIMING mechanic (Milestone 23 addendum "暗置/明置"): asked at the start of
   *  `player`'s own turn (`Phase.RoundStart`) while anything is still hidden -- bots always
   *  reveal everything remaining immediately (see `makeBotController`'s `chooseReveal`, no
   *  bluffing strategy to gain from staying hidden); a claimed human gets the real choice, and
   *  may legitimately decline forever. The FIRST time either general flips face-up for a given
   *  player, their kingdom becomes known -- `faction`/`isAmbitionist` are assigned right then
   *  (`assignHegemonyFaction`, using the Room-level running quota tally), not at draft time. */
  private async runHegemonyReveal(player: GamePlayer): Promise<void> {
    if (player.mainRevealed && player.deputyRevealed) return;
    const wasHidden = player.faction === "";
    const controller = this.controllers.get(player.id)!;
    const choice = await controller.chooseReveal(player, !player.mainRevealed, !player.deputyRevealed);
    const revealedNow: string[] = [];
    if (choice.main && !player.mainRevealed) {
      player.mainRevealed = true;
      revealedNow.push(`chủ tướng ${player.generalName}`);
    }
    if (choice.deputy && !player.deputyRevealed) {
      player.deputyRevealed = true;
      revealedNow.push(`phó tướng ${player.deputyGeneralName}`);
    }
    if (revealedNow.length === 0) return;
    if (wasHidden) {
      const { faction, isAmbitionist } = assignHegemonyFaction(player.id, player.kingdom, this.hegemonyKingdomCounts, this.hegemonyKingdomQuota);
      player.faction = faction;
      player.isAmbitionist = isAmbitionist;
    }
    this.log.push(`${player.id} minh trí ${revealedNow.join(", ")} -- thế lực: ${factionLabelVI(this.mode, player)}`);
    // A reveal (not just a death) can itself be what finally lets an already-converged table
    // conclude -- checkHegemonyWinCondition blocks on ANY hidden living player, so the LAST one
    // revealing might complete it right here.
    this.checkHegemonyGameEnd();
    // The 2 one-time reveal-completion bonuses (companion pair, leftover-half-HP) only fire the
    // instant BOTH generals are now shown, and only if the game didn't just end right above.
    if (!this.gameOver && player.mainRevealed && player.deputyRevealed) {
      await this.resolveHegemonyRevealBonuses(player);
    }
    this.onLiveUpdate?.();
  }

  /** Hegemony-only, fires exactly once per player the instant their SECOND general reveals
   *  (matches the real upstream `gamerule.cpp`'s `GeneralShown` handler): a 珠联璧合 companion
   *  bonus (recover 1 hp if wounded, or draw 2 cards) if the drafted main+deputy pair is a real
   *  companion pair (`isCompanionPair`), and a leftover-half-HP bonus draw (1 card) if
   *  `combineHegemonyHp` found an unpaired half. Both are the player's own optional choice. */
  private async resolveHegemonyRevealBonuses(player: GamePlayer): Promise<void> {
    const controller = this.controllers.get(player.id)!;
    if (isCompanionPair(player.general, player.deputyGeneral)) {
      const choice = await controller.chooseCompanionBonus(player, player.isWounded());
      if (choice === "recover") {
        await heal(this.makeContext(this.players.filter((p) => p.alive)), player, 1);
        this.log.push(`${player.id} hồi 1 máu (珠联璧合)`);
      } else if (choice === "draw") {
        this.drawCards(player, 2);
        this.log.push(`${player.id} rút 2 lá (珠联璧合)`);
      }
    }
    const mainDef = GENERALS.find((g) => g.name === player.general);
    const deputyDef = GENERALS.find((g) => g.name === player.deputyGeneral);
    if (mainDef && deputyDef && combineHegemonyHp(mainDef.maxHp, deputyDef.maxHp).bonusDraw) {
      if (await controller.wantsHalfMaxHpBonusDraw(player)) {
        this.drawCards(player, 1);
        this.log.push(`${player.id} rút 1 lá (thể lực lẻ nửa)`);
      }
    }
    this.onLiveUpdate?.();
  }

  /** Hegemony-only: resolves `checkHegemonyWinCondition` and, if it fires, sets `gameOver` +
   *  logs the result + force-reveals everyone (matching Identity mode's own "reveal every role
   *  once the match ends" rule). Otherwise (game continues), checks the Ao Chiến trigger. Shared
   *  by `killPlayer` (checked after every death) and `runHegemonyReveal` (checked after every
   *  reveal, see its own call site comment for why). */
  private checkHegemonyGameEnd(): void {
    if (this.gameOver) return;
    const result = checkHegemonyWinCondition(this.players);
    if (result) {
      this.gameOver = result;
      const winner = this.players.find((p) => p.id === result.winners[0])!;
      this.log.push(`Kết thúc ván: ${factionLabelVI(this.mode, winner)} thắng`);
      for (const p of this.players) {
        p.mainRevealed = true;
        p.deputyRevealed = true;
      }
    } else if (!this.aoChienActive) {
      this.checkAoChienTrigger();
    }
  }

  /** Runs every skill.onDamaged hook `target` has (e.g. Ganglie) -- see skill.ts. */
  private async triggerOnDamaged(target: GamePlayer, source: GamePlayer): Promise<void> {
    for (const skill of target.skills) {
      if (target.alive) await skill.onDamaged?.(this.makeContext(this.players.filter((p) => p.alive)), target, source, this.rng);
    }
  }

  /** Runs every skill.onDamageDealt hook `source` has (e.g. Kuanggu) -- see skill.ts. */
  private async triggerOnDamageDealt(source: GamePlayer, target: GamePlayer, amount: number): Promise<void> {
    for (const skill of source.skills) {
      if (source.alive) await skill.onDamageDealt?.(this.makeContext(this.players.filter((p) => p.alive)), source, target, amount);
    }
  }

  /** Suishi (Tianfeng): every alive ally of a player who just started dying draws 1 card. */
  private async triggerOnAllyDying(dyingPlayer: GamePlayer): Promise<void> {
    const ctx = this.makeContext(this.players.filter((p) => p.alive));
    for (const p of ctx.alivePlayers.filter((p) => p !== dyingPlayer)) {
      for (const skill of p.skills) await skill.onAllyDying?.(ctx, p, dyingPlayer, this.rng);
    }
  }

  private makeContext(alive: GamePlayer[]): EngineContext {
    return {
      alivePlayers: alive,
      discardPile: this.discardPile,
      aoChienActive: this.aoChienActive,
      isGameOver: () => this.gameOver !== null,
      log: this.log,
      rng: this.rng,
      draw: (player, n) => this.drawCards(player, n),
      drawTop: () => this.drawOne(),
      onDying: (dyingPlayer, killer) => this.killPlayer(dyingPlayer, killer),
      onDyingStarted: (dyingPlayer) => this.triggerOnAllyDying(dyingPlayer),
      onDamage: (target, source) => this.triggerOnDamaged(target, source),
      onDamageDealt: (source, target, amount) => this.triggerOnDamageDealt(source, target, amount),
      askDodge: (player) => this.controllers.get(player.id)!.wantsToDodge(player),
      askPeach: (player) => this.controllers.get(player.id)!.wantsToUsePeach(player),
      askPeachForOther: (rescuer, dyingPlayer) => this.controllers.get(rescuer.id)!.wantsToUsePeachForOther(rescuer, dyingPlayer),
      askDuelSlash: (player) => this.controllers.get(player.id)!.wantsToPlaySlashInDuel(player),
      askGanglieDiscard: (player) => this.controllers.get(player.id)!.wantsToDiscardForGanglie(player),
      askUseSelfAction: (player, skillName) => this.controllers.get(player.id)!.wantsToUseSelfAction(player, skillName),
      askUseKylinBow: (player) => this.controllers.get(player.id)!.wantsToUseKylinBow(player),
      askUseIceSword: (player) => this.controllers.get(player.id)!.wantsToUseIceSword(player),
      askUseAxe: (player) => this.controllers.get(player.id)!.wantsToUseAxe(player),
      askUseEightDiagram: (player) => this.controllers.get(player.id)!.wantsToUseEightDiagram(player),
      askUseDoubleSword: (player) => this.controllers.get(player.id)!.wantsToUseDoubleSword(player),
      askDiscardForDoubleSword: (player) => this.controllers.get(player.id)!.wantsToDiscardForDoubleSword(player),
      askChooseAnyPlayer: (player, candidates) => this.controllers.get(player.id)!.chooseAnyPlayerTarget(player, candidates),
      askSavageAssaultSlash: (player) => this.controllers.get(player.id)!.wantsToDiscardForSavageAssault(player),
      askArcheryAttackJink: (player) => this.controllers.get(player.id)!.wantsToDiscardForArcheryAttack(player),
      askPickCard: (player, candidates) => this.controllers.get(player.id)!.choosePickCard(player, candidates),
      askPickPlayerCard: (player, owner, candidates) => this.controllers.get(player.id)!.choosePlayerCard(player, owner, candidates),
      peekTop: (n) => this.peekTop(n),
      arrangeTop: (top, bottom) => this.arrangeTop(top, bottom),
      askGuanxingBottom: (player, revealed) => this.controllers.get(player.id)!.chooseGuanxingBottom(player, revealed),
      askGuicaiRetrial: (player, judgeOwner, currentCard, reason) =>
        this.controllers.get(player.id)!.wantsToUseGuicai(player, judgeOwner, currentCard, reason),
      askChooseDiscards: async (player, count) => {
        if (count <= 0 || player.hand.length === 0) return [];
        const n = Math.min(count, player.hand.length);
        const chosen = await this.controllers.get(player.id)!.chooseDiscards(player, n);
        const distinctHeld = [...new Set(chosen)].filter((c) => player.hand.includes(c));
        return distinctHeld.length === n ? distinctHeld : pickLeastImportantCards(player.hand, n);
      },
      // Unlike askChooseDiscards (fixed count, forced fallback if declined/invalid), this is a
      // free player choice within [min, max] -- an invalid/declined response returns [], never
      // a substituted fallback, matching chooseSpearCards' own "never forced" precedent.
      askAnyHandCards: async (player, min, max) => {
        if (player.hand.length < min) return [];
        const chosen = await this.controllers.get(player.id)!.chooseAnyHandCards(player, min, max);
        const distinctHeld = [...new Set(chosen)].filter((c) => player.hand.includes(c));
        return distinctHeld.length >= min && distinctHeld.length <= max ? distinctHeld : [];
      },
      equipPlayer: (target, card) => this.equip(target, card),
      askNullification: (source, target, kind) => this.resolveNullificationWindow(alive, source, target, kind),
      revealPrivately: (viewer, reveal) => this.onPrivateReveal?.(viewer.id, reveal),
      askKnownBothChoice: async (player, target, options) => {
        const choice = await this.controllers.get(player.id)!.chooseKnownBothOption(player, target, options);
        return options.includes(choice) ? choice : options[0];
      },
    };
  }

  /** Nullification/HegNullification counter-play window (Milestone 31) -- offered once for
   *  `kind` (played by `source`) about to take effect against `target`. Wraps `offerNullification`
   *  (the actual, possibly-recursive chain) together with whatever HegNullification "all" scope
   *  the FIRST responder chose (if any), for the 2 AOE per-target loops (trick.ts's
   *  resolveSavageAssault/resolveArcheryAttack, via `EngineContext.askNullification`) to consume;
   *  every other trick kind calls this directly from `tryPlayOnce`/`tryPlayTargeted`/
   *  `tryPlayDelayedTrick` below and only reads `.blocked`. */
  private async resolveNullificationWindow(
    alive: GamePlayer[],
    source: GamePlayer,
    target: GamePlayer,
    kind: CardKind,
  ): Promise<{ blocked: boolean; shieldFaction: string | null }> {
    let shieldFaction: string | null = null;
    const blocked = await this.offerNullification(alive, source, target, kind, (faction) => {
      shieldFaction = faction;
    });
    return { blocked, shieldFaction };
  }

  /** The actual chain: asks each alive player holding a Nullification/HegNullification card (in
   *  seat order starting right after `target` -- the player the resolving effect is against --
   *  same "closest-affected-player-first" precedent as `askPeachForOther`'s ally-rescue order;
   *  this engine has no real network race to model, unlike the true multiplayer engine's
   *  simultaneous-race-then-random-pick) whether they want to play it; the first "yes" wins. A
   *  played card is itself immediately counter-nullifiable by a FURTHER Nullification/
   *  HegNullification (recursion -- `onScopeChosen` is NOT forwarded into the recursive call,
   *  since the "single vs. all" scope choice only ever applies to the card directly answering
   *  the ORIGINAL trick; nullifying a Nullification-in-flight is never itself an AOE-multi-
   *  target situation): an odd chain depth cancels the original effect, an even depth
   *  (including 0, nobody responds) doesn't. Returns true iff `kind` ends up cancelled. */
  private async offerNullification(
    alive: GamePlayer[],
    source: GamePlayer,
    target: GamePlayer,
    kind: CardKind,
    onScopeChosen?: (faction: string) => void,
  ): Promise<boolean> {
    const startIdx = alive.indexOf(target);
    const order = startIdx === -1 ? alive : [...alive.slice(startIdx + 1), ...alive.slice(0, startIdx + 1)];
    for (const responder of order) {
      const nullifyCard = responder.hand.find((c) => c.kind === CardKind.Nullification || c.kind === CardKind.HegNullification);
      if (!nullifyCard) continue;
      if (!(await this.controllers.get(responder.id)!.wantsToNullify(responder, kind, source, target))) continue;
      responder.hand.splice(responder.hand.indexOf(nullifyCard), 1);
      this.discardPile.push(nullifyCard);
      const cardLabel = nullifyCard.kind === CardKind.HegNullification ? "Vô Giải Khả Kích - Quốc" : "Vô Giải Khả Kích";
      this.log.push(`${responder.id} dùng ${cardLabel} lên ${TRICK_LABEL_VI[kind] ?? kind} (${source.id} -> ${target.id})`);
      if (onScopeChosen && nullifyCard.kind === CardKind.HegNullification && target.faction !== "") {
        const scope = await this.controllers.get(responder.id)!.chooseHegNullificationScope(responder, target);
        if (scope === "all") {
          this.log.push(`${responder.id} mở rộng phạm vi triệt tiêu sang cả thế lực của ${target.id}`);
          onScopeChosen(target.faction);
        }
      }
      const counterCancelled = await this.offerNullification(alive, responder, target, nullifyCard.kind);
      return !counterCancelled;
    }
    return false;
  }

  /** Registers a callback fired immediately after an equip resolves. Broadcast() otherwise only
   *  fires once per fully COMPLETED turn (scheduleLoop) -- without this, a newly-equipped
   *  weapon/horse (and its buffs: attack range, distance deltas) wouldn't show up for any client
   *  watching until the whole turn finished, even though the buff is already live server-side
   *  the instant `player.weapon`/`defenseHorse`/`offenseHorse` is set below. */
  setLiveUpdateCallback(cb: (() => void) | null): void {
    this.onLiveUpdate = cb;
  }

  /** Registers KnownBoth's private-reveal delivery hook (server.ts wires this straight to a
   *  one-way message sent to just the viewing player's own socket). Mirrors
   *  `setLiveUpdateCallback` above exactly -- see `onPrivateReveal`'s own doc comment. */
  setPrivateRevealCallback(cb: ((viewerId: string, reveal: PrivateReveal) => void) | null): void {
    this.onPrivateReveal = cb;
  }

  private async equip(player: GamePlayer, equipCard: Card): Promise<void> {
    let replaced: Card | null = null;
    if (equipCard.kind === CardKind.Weapon) {
      replaced = player.weapon;
      player.weapon = equipCard;
    } else if (equipCard.kind === CardKind.Armor) {
      replaced = player.armor;
      player.armor = equipCard;
    } else if (equipCard.horseDelta === 1) {
      replaced = player.defenseHorse;
      player.defenseHorse = equipCard;
    } else {
      replaced = player.offenseHorse;
      player.offenseHorse = equipCard;
    }
    this.log.push(`${player.id} trang bị ${equipCard.weaponName ?? equipCard.horseName ?? equipCard.armorName}`);
    if (replaced) {
      this.discardPile.push(replaced);
      // SilverLion (armor, Milestone 34): heals 1 hp on leaving the equip zone while alive and
      // wounded -- this branch covers the "replaced by a newly-equipped armor" departure;
      // combat.ts's `detachCardFrom` covers every OTHER departure (Dismantlement/Snatch/
      // IceSword). A player can only equip 1 armor at a time, so `replaced` here is always the
      // OLD armor being displaced, never anything else.
      if (replaced.armorName === "SilverLion" && player.alive && player.isWounded()) {
        await heal(this.makeContext(this.players.filter((p) => p.alive)), player, 1);
        this.log.push(`${player.id} hồi 1 máu do Bạch Ngân Sư Tử rời trang bị`);
      }
      // Xiaoji (Sunshangxiang): draws 2 whenever an equip of hers leaves the equip zone.
      for (const skill of player.skills) {
        await skill.onEquipLost?.(this.makeContext(this.players.filter((p) => p.alive)), player);
      }
    }
    this.onLiveUpdate?.();
  }

  /** Sijian (Tianfeng): fires on `player`'s own skills right when a played card leaves their
   *  hand at 0 count. Checked after every hand-emptying splice site below. */
  private async checkHandEmptied(player: GamePlayer): Promise<void> {
    if (player.handcardNum !== 0) return;
    const ctx = this.makeContext(this.players.filter((p) => p.alive));
    for (const skill of player.skills) await skill.onHandEmptied?.(ctx, player, this.rng);
  }

  /**
   * Plays at most one held copy of `kind`. `selectTarget` is pure (no hand mutation) and picks
   * the target/validity; only if it succeeds do we splice the card out of the hand and push it
   * to the discard pile, THEN call `resolve`. This order matters: Duel's resolution can splice
   * further cards out of the ACTOR's own hand (the alternating Slash exchange), which would
   * invalidate a captured hand index if the played card were removed only afterward.
   */
  private async tryPlayOnce<T>(
    player: GamePlayer,
    kind: CardKind,
    selectTarget: (alive: GamePlayer[]) => T | null,
    resolve: (card: Card, target: T, alive: GamePlayer[]) => void | Promise<void>,
    explicitCard?: Card, // freeform play: card already chosen by the player -- skip auto-find + the wantsToPlayTrick ask
  ): Promise<void> {
    if (this.gameOver || !player.alive) return;
    const idx = explicitCard ? player.hand.indexOf(explicitCard) : player.hand.findIndex((c) => c.kind === kind);
    if (idx === -1) return;
    const alive = this.players.filter((p) => p.alive);
    const target = selectTarget(alive);
    if (target === null) return;
    if (!explicitCard && !(await this.controllers.get(player.id)!.wantsToPlayTrick(player, kind))) return;
    const [card] = player.hand.splice(idx, 1);
    this.discardPile.push(card);
    await this.checkHandEmptied(player);

    // Huoshou/Juxiang (Menghuo/Zhurong): another player may claim the played Savage Assault card
    // once it resolves, instead of it staying in the discard pile.
    if (kind === CardKind.SavageAssault) {
      const claimant = this.players.find(
        (p) => p.alive && p !== player && p.skills.some((s) => s.claimsUsedSavageAssaultCard?.(p)),
      );
      if (claimant) {
        const pileIdx = this.discardPile.indexOf(card);
        if (pileIdx !== -1) {
          this.discardPile.splice(pileIdx, 1);
          claimant.hand.push(card);
          this.log.push(`${claimant.id} nhận lại lá Nam Man Nhập Xâm vừa dùng (juxiang)`);
        }
      }
    }

    // Nullification/HegNullification counter-play window (Milestone 31): offered once for the
    // whole card use, EXCEPT SavageAssault/ArcheryAttack, which get real per-target granularity
    // inside their own resolvers instead (see trick.ts's header). `player` doubles as the
    // "target" here -- every kind routed through tryPlayOnce is either self-targeting (ExNihilo/
    // AwaitExhausted) or a no-single-target whole-table effect (GodSalvation/AmazingGrace/the 2
    // AOE cards skipped above), so there's no other real target to pass.
    if (kind !== CardKind.SavageAssault && kind !== CardKind.ArcheryAttack) {
      const { blocked } = await this.resolveNullificationWindow(alive, player, player, kind);
      if (blocked) {
        for (const skill of player.skills) await skill.onTrickPlayed?.(this.makeContext(alive), player, kind);
        this.onLiveUpdate?.();
        return;
      }
    }
    await resolve(card, target, alive);
    for (const skill of player.skills) await skill.onTrickPlayed?.(this.makeContext(alive), player, kind);
    this.onLiveUpdate?.();
  }

  /**
   * Like `tryPlayOnce`, but for the single-target tricks: the controller picks WHO from
   * `candidatesFor`'s legal list (or null to decline) instead of a plain yes/no gate.
   */
  private async tryPlayTargeted(
    player: GamePlayer,
    kind: CardKind,
    candidatesFor: (alive: GamePlayer[]) => GamePlayer[],
    resolve: (card: Card, target: GamePlayer, alive: GamePlayer[]) => void | Promise<void>,
    findCard: (player: GamePlayer) => Card | null = (p) => p.hand.find((c) => c.kind === kind) ?? null,
  ): Promise<void> {
    if (this.gameOver || !player.alive) return;
    const card = findCard(player);
    if (!card) return;
    const alive = this.players.filter((p) => p.alive);
    const candidates = candidatesFor(alive);
    if (candidates.length === 0) return;
    const target = await this.controllers.get(player.id)!.chooseTrickTarget(player, kind, candidates);
    if (!target) return;

    // Weimu (Jiaxu): immune to a black-suited trick card targeting them -- the card is still
    // spent (it was legally played), the target just fizzles.
    const blackTrickBlocked =
      (card.suit === Suit.Spade || card.suit === Suit.Club) && target.skills.some((s) => s.immuneToBlackTrick?.(target));

    player.hand.splice(player.hand.indexOf(card), 1);
    this.discardPile.push(card);
    if (card.kind !== kind) this.log.push(`${player.id} biến 1 lá bài thành ${TRICK_LABEL_VI[kind] ?? kind} (kỹ năng biến hóa)`);
    await this.checkHandEmptied(player);

    if (blackTrickBlocked) {
      this.log.push(`${target.id} miễn nhiễm với ${TRICK_LABEL_VI[kind] ?? kind} này (weimu)`);
      for (const skill of player.skills) await skill.onTrickPlayed?.(this.makeContext(alive), player, kind);
      this.onLiveUpdate?.();
      return;
    }

    // Nullification/HegNullification counter-play window (Milestone 31) -- offered once for the
    // whole card use (see tryPlayOnce's own comment on this same window for why the 2 AOE cards
    // are the only exception, and they never reach here -- this method is single-target only).
    const { blocked } = await this.resolveNullificationWindow(alive, player, target, kind);
    if (blocked) {
      for (const skill of player.skills) await skill.onTrickPlayed?.(this.makeContext(alive), player, kind);
      this.onLiveUpdate?.();
      return;
    }
    await resolve(card, target, alive);
    for (const skill of player.skills) await skill.onTrickPlayed?.(this.makeContext(alive), player, kind);
    this.onLiveUpdate?.();
  }

  /** Like `tryPlayTargeted`, but for delayed tricks (currently only Indulgence): the played
   *  card is NOT discarded immediately -- it's ATTACHED to the target's judge area instead
   *  (`attach`), to actually resolve later during the target's own Judge phase (see
   *  `runJudgePhase`). Shares the same Weimu (black-trick immunity) and `chooseTrickTarget`
   *  gating as `tryPlayTargeted`. */
  private async tryPlayDelayedTrick(
    player: GamePlayer,
    kind: CardKind,
    candidatesFor: (alive: GamePlayer[]) => GamePlayer[],
    attach: (card: Card, target: GamePlayer, alive: GamePlayer[]) => void,
    findCard: (player: GamePlayer) => Card | null = (p) => p.hand.find((c) => c.kind === kind) ?? null,
  ): Promise<void> {
    if (this.gameOver || !player.alive) return;
    const card = findCard(player);
    if (!card) return;
    const alive = this.players.filter((p) => p.alive);
    const candidates = candidatesFor(alive);
    if (candidates.length === 0) return;
    const target = await this.controllers.get(player.id)!.chooseTrickTarget(player, kind, candidates);
    if (!target) return;

    const blackTrickBlocked =
      (card.suit === Suit.Spade || card.suit === Suit.Club) && target.skills.some((s) => s.immuneToBlackTrick?.(target));

    player.hand.splice(player.hand.indexOf(card), 1);
    if (card.kind !== kind) this.log.push(`${player.id} biến 1 lá bài thành ${TRICK_LABEL_VI[kind] ?? kind} (kỹ năng biến hóa)`);
    await this.checkHandEmptied(player);

    if (blackTrickBlocked) {
      this.discardPile.push(card);
      this.log.push(`${target.id} miễn nhiễm với ${TRICK_LABEL_VI[kind] ?? kind} này (weimu)`);
      for (const skill of player.skills) await skill.onTrickPlayed?.(this.makeContext(alive), player, kind);
      this.onLiveUpdate?.();
      return;
    }

    // Nullification/HegNullification counter-play window (Milestone 31): a delayed trick is
    // nullifiable at ATTACH time, not later when its judgment actually triggers (matches the
    // real rule) -- unlike tryPlayOnce/tryPlayTargeted above, the card was NOT already pushed to
    // discardPile (it normally goes to `target.judgeArea` via `attach` instead), so a blocked
    // use pushes it there explicitly here.
    const { blocked } = await this.resolveNullificationWindow(alive, player, target, kind);
    if (blocked) {
      this.discardPile.push(card);
      for (const skill of player.skills) await skill.onTrickPlayed?.(this.makeContext(alive), player, kind);
      this.onLiveUpdate?.();
      return;
    }
    attach(card, target, alive);
    for (const skill of player.skills) await skill.onTrickPlayed?.(this.makeContext(alive), player, kind);
    this.onLiveUpdate?.();
  }

  private async tryPlaySlash(player: GamePlayer, explicitCard?: Card): Promise<boolean> {
    if (this.gameOver || !player.alive || player.tianyiLostThisTurn) return false;
    const slashCard = explicitCard ?? findSlashLikeCard(player, this.aoChienActive);
    // Spear (weapon): no real/viewAs Slash card in hand -- fall back to sacrificing 2 hand
    // cards as one, if equipped. Never reached when `explicitCard` is set (a human proactively
    // chose a specific held card via the freeform path, not this fallback).
    if (!slashCard) return explicitCard ? false : this.trySpearSlash(player);
    const alive = this.players.filter((p) => p.alive);
    const candidates = slashCandidates(alive, player);
    if (candidates.length === 0) return false;
    const target = await this.controllers.get(player.id)!.chooseSlashTarget(player, candidates);
    if (!target) return false;
    if (slashCard.kind !== CardKind.Slash) this.log.push(`${player.id} biến 1 lá bài thành Sát (kỹ năng biến hóa)`);
    player.hand.splice(player.hand.indexOf(slashCard), 1);
    await this.checkHandEmptied(player);
    await resolveSlash(this.makeContext(alive), player, target, slashCard);
    await this.maybeResolveTianyiBonusTarget(player, target);
    this.onLiveUpdate?.();
    return true;
  }

  /** Spear (weapon): uses exactly 2 of `player`'s own hand cards as if they were a Slash --
   *  the controller picks which 2 (`chooseSpearCards`); an invalid/declined response (not
   *  exactly 2 distinct held cards) does nothing, matching the card's real "may" wording (no
   *  forced-discard fallback like `chooseDiscards`). One of the 2 becomes the `slashCard` passed
   *  to `resolveSlash` (which pushes it to the discard pile itself); the other is discarded here
   *  -- between the two, both real physical cards end up accounted for, preserving card
   *  conservation. */
  private async trySpearSlash(player: GamePlayer): Promise<boolean> {
    if (this.gameOver || !player.alive || player.tianyiLostThisTurn || player.weapon?.weaponName !== "Spear" || player.hand.length < 2) {
      return false;
    }
    const alive = this.players.filter((p) => p.alive);
    const candidates = slashCandidates(alive, player);
    if (candidates.length === 0) return false;
    const chosen = await this.controllers.get(player.id)!.chooseSpearCards(player);
    const distinctHeld = [...new Set(chosen)].filter((c) => player.hand.includes(c));
    if (distinctHeld.length !== 2) return false; // declined, or an invalid response -- never forced
    const target = await this.controllers.get(player.id)!.chooseSlashTarget(player, candidates);
    if (!target) return false;
    const [paid, slashCard] = distinctHeld;
    player.hand.splice(player.hand.indexOf(paid), 1);
    player.hand.splice(player.hand.indexOf(slashCard), 1);
    this.discardPile.push(paid);
    this.log.push(`${player.id} dùng Trượng Bát Xà Mâu: 2 lá bài như 1 Sát`);
    await this.checkHandEmptied(player);
    await resolveSlash(this.makeContext(alive), player, target, slashCard);
    await this.maybeResolveTianyiBonusTarget(player, target);
    this.onLiveUpdate?.();
    return true;
  }

  /** Tianyi (Taishici): if `player` won a pindian this turn, the Slash they just played
   *  (`primaryTarget`) may also hit a 2nd, rangeless target -- see `combat.ts`'s
   *  `resolveSlashBonusTarget` doc comment for the simplified-pipeline rationale. The buff
   *  itself is NOT consumed here (`tianyiWonThisTurn` only clears at next turn's start) --
   *  every Slash `player` plays for the rest of this turn gets this same offer, matching the
   *  real "trong lượt này" (for this turn) duration. */
  private async maybeResolveTianyiBonusTarget(player: GamePlayer, primaryTarget: GamePlayer): Promise<void> {
    if (!player.tianyiWonThisTurn || this.gameOver || !player.alive) return;
    const candidates = this.players.filter((p) => p.alive && p !== player && p !== primaryTarget);
    if (candidates.length === 0) return;
    const controller = this.controllers.get(player.id)!;
    if (!(await controller.wantsToUseSelfAction(player, "tianyi-bonus"))) return;
    const target = await controller.chooseAnyPlayerTarget(player, candidates);
    if (!target) return;
    await resolveSlashBonusTarget(this.makeContext(this.players.filter((p) => p.alive)), player, target);
    this.onLiveUpdate?.();
  }

  /** Real Sanguosha slash limit: 1 per turn by default, raised by e.g. Paoxiao (skill.ts), or
   *  removed entirely by Crossbow (no cap at all -- `Infinity` is safe here since every caller's
   *  loop already stops on its own once no Slash-like card or legal target remains; it never
   *  spins forever). */
  private computeSlashLimit(player: GamePlayer): number {
    if (player.weapon?.weaponName === "Crossbow") return Infinity;
    let slashesAllowed = 1;
    for (const skill of player.skills) {
      if (skill.slashLimit) slashesAllowed = Math.max(slashesAllowed, skill.slashLimit(player));
    }
    return slashesAllowed;
  }

  private async runPlayPhase(player: GamePlayer): Promise<void> {
    const controller = this.controllers.get(player.id)!;
    if (controller.chooseFreeAction) {
      await this.runFreeformPlayPhase(player, controller as Controller & { chooseFreeAction: NonNullable<Controller["chooseFreeAction"]> });
      return;
    }

    // Equip pass: auto-equip every Weapon/Horse card held, if the controller wants to (free
    // action, no target, no limit -- the bot policy always wants to).
    for (let i = player.hand.length - 1; i >= 0; i--) {
      const c = player.hand[i];
      if (c.kind === CardKind.Weapon || c.kind === CardKind.Horse || c.kind === CardKind.Armor) {
        if (await controller.wantsToEquip(player, c)) {
          player.hand.splice(i, 1);
          await this.equip(player, c);
          await this.checkHandEmptied(player);
        }
      }
    }

    // Proactive Peach self-heal: real Sanguosha lets a player spend a held Peach on themselves
    // any time during their own turn while wounded. Gated by its own dedicated ask (bots decline
    // by default -- see controller.ts's wantsToUsePeachSelfHeal -- preserving the pre-existing
    // fixed-pass behavior of never proactively burning Peach/Analeptic outside a real dying
    // emergency); a claimed human seat gets the real choice via the freeform path below instead.
    // Skipped entirely once Ao Chiến is active (see checkAoChienTrigger) -- Peach no longer heals.
    for (let i = player.hand.length - 1; i >= 0 && player.alive && !this.gameOver && !this.aoChienActive; i--) {
      if (!player.isWounded()) break;
      const c = player.hand[i];
      if (c.kind !== CardKind.Peach) continue;
      if (!(await controller.wantsToUsePeachSelfHeal(player))) continue;
      player.hand.splice(i, 1);
      this.discardPile.push(c);
      await this.checkHandEmptied(player);
      await resolvePeachSelfHeal(this.makeContext(this.players.filter((p) => p.alive)), player);
      this.onLiveUpdate?.();
    }

    // Proactive Analeptic buff: real Sanguosha lets a player spend a held Analeptic during their
    // own turn to arm +1 damage on their next Slash this turn. Same dedicated-ask/bot-declines
    // pattern as the Peach self-heal loop above (see controller.ts's wantsToUseAnalepticBuff).
    for (let i = player.hand.length - 1; i >= 0 && player.alive && !this.gameOver; i--) {
      const c = player.hand[i];
      if (c.kind !== CardKind.Analeptic) continue;
      if (!(await controller.wantsToUseAnalepticBuff(player))) continue;
      player.hand.splice(i, 1);
      this.discardPile.push(c);
      await this.checkHandEmptied(player);
      resolveAnalepticBuff(this.makeContext(this.players.filter((p) => p.alive)), player);
      this.onLiveUpdate?.();
    }

    // Proactive self-action skills (e.g. Kurou, Dianwei's Qiangxi, Huatuo's Qingnang): once each
    // per Play phase, gated by wantsToUseSelfAction. Run before the other tricks so any cards
    // drawn (e.g. Kurou's) are available for the rest of the phase.
    for (const skill of player.skills) {
      if (!player.alive || this.gameOver) break;
      if (skill.selfAction) {
        if (await controller.wantsToUseSelfAction(player, skill.name)) {
          await skill.selfAction(this.makeContext(this.players.filter((p) => p.alive)), player, this.rng);
          this.onLiveUpdate?.();
        }
      } else if (skill.activeAction) {
        const alive = this.players.filter((p) => p.alive);
        const candidates = skill.activeAction.candidatesFor(alive, player);
        if (candidates.length === 0) continue;
        if (!(await controller.wantsToUseSelfAction(player, skill.name))) continue;
        const target = await controller.chooseAnyPlayerTarget(player, candidates);
        if (!target) continue;
        await skill.activeAction.run(this.makeContext(alive), player, target, this.rng);
        this.onLiveUpdate?.();
      }
    }

    await this.tryPlayOnce(
      player,
      CardKind.ExNihilo,
      (alive) => alive, // no target selection; always legal
      (_card, alive) => resolveExNihilo(this.makeContext(alive), player),
    );
    await this.tryPlayTargeted(
      player,
      CardKind.Dismantlement,
      (alive) => dismantlementCandidates(player, alive),
      (_card, target, alive) => resolveDismantlement(this.makeContext(alive), player, target),
      (p) => findDismantlementLikeCard(p),
    );
    await this.tryPlayTargeted(
      player,
      CardKind.Snatch,
      (alive) => snatchCandidates(player, alive),
      (_card, target, alive) => resolveSnatch(this.makeContext(alive), player, target),
    );
    await this.tryPlayTargeted(
      player,
      CardKind.Duel,
      (alive) => duelCandidates(player, alive),
      (_card, target, alive) => resolveDuel(this.makeContext(alive), player, target),
      (p) => findDuelLikeCard(p),
    );
    await this.tryPlayTargeted(
      player,
      CardKind.FireAttack,
      (alive) => fireAttackCandidates(player, alive),
      (_card, target, alive) => resolveFireAttack(this.makeContext(alive), player, target),
      (p) => findFireAttackLikeCard(p),
    );
    await this.tryPlayTargeted(
      player,
      CardKind.Collateral,
      (alive) => collateralCandidates(player, alive),
      (_card, target, alive) => resolveCollateral(this.makeContext(alive), player, target),
    );
    await this.tryPlayTargeted(
      player,
      CardKind.BefriendAttacking,
      (alive) => befriendAttackingCandidates(player, alive),
      (_card, target, alive) => resolveBefriendAttacking(this.makeContext(alive), player, target),
    );
    await this.tryPlayTargeted(
      player,
      CardKind.IronChain,
      (alive) => ironChainCandidates(alive),
      (_card, target, alive) => resolveIronChain(this.makeContext(alive), target),
    );
    await this.tryPlayTargeted(
      player,
      CardKind.KnownBoth,
      (alive) => knownBothCandidates(player, alive),
      (_card, target, alive) => resolveKnownBoth(this.makeContext(alive), player, target),
    );
    await this.tryPlayDelayedTrick(
      player,
      CardKind.Indulgence,
      (alive) => indulgenceCandidates(player, alive),
      (card, target) => attachIndulgence(this.makeContext(this.players.filter((p) => p.alive)), target, card),
      (p) => findIndulgenceLikeCard(p),
    );
    await this.tryPlayDelayedTrick(
      player,
      CardKind.SupplyShortage,
      (alive) => supplyShortageCandidates(player, alive),
      (card, target) => attachSupplyShortage(this.makeContext(this.players.filter((p) => p.alive)), target, card),
      (p) => findSupplyShortageLikeCard(p),
    );
    await this.tryPlayDelayedTrick(
      player,
      CardKind.Lightning,
      () => lightningCandidates(player),
      (card, target) => attachLightning(this.makeContext(this.players.filter((p) => p.alive)), target, card),
    );
    await this.tryPlayOnce(
      player,
      CardKind.SavageAssault,
      (alive) => alive,
      (_card, alive) => resolveSavageAssault(this.makeContext(alive), player),
    );
    await this.tryPlayOnce(
      player,
      CardKind.AwaitExhausted,
      () => awaitExhaustedCandidates(player),
      (_card, alive) => resolveAwaitExhausted(this.makeContext(alive), player),
    );
    await this.tryPlayOnce(
      player,
      CardKind.ArcheryAttack,
      (alive) => alive,
      (_card, alive) => resolveArcheryAttack(this.makeContext(alive), player),
    );
    await this.tryPlayOnce(
      player,
      CardKind.GodSalvation,
      (alive) => (alive.some((p) => p.isWounded()) ? alive : null), // don't waste it with nobody hurt
      (_card, alive) => resolveGodSalvation(this.makeContext(alive)),
    );
    await this.tryPlayOnce(
      player,
      CardKind.AmazingGrace,
      (alive) => alive,
      (_card, alive) => resolveAmazingGrace(this.makeContext(alive), player),
    );

    // Slash limit: 1 by default, raised by e.g. Paoxiao (skill.ts), or removed entirely by
    // Crossbow -- see computeSlashLimit.
    let slashesAllowed = this.computeSlashLimit(player);
    while (slashesAllowed > 0 && player.alive && !this.gameOver) {
      if (!(await this.tryPlaySlash(player))) break;
      slashesAllowed--;
    }
  }

  /**
   * Every currently-legal thing `player` could do right now in a freeform Play phase: every
   * Weapon/Horse card (equip), every playable trick/Slash card (grouped by what it resolves AS,
   * viewAs-aware, gated on having a legal target where one is required), and every not-yet-used
   * self/active-action skill this turn. Unlike the fixed automatic pass, a held kind with
   * multiple copies (e.g. 2 Ex Nihilo) offers each copy as its own action -- real Sanguosha has
   * no "once per kind per turn" cap, only Slash's explicit limit.
   */
  private computeLegalActions(player: GamePlayer, slashesRemaining: number, usedSkillsThisTurn: Set<string>): FreeAction[] {
    const alive = this.players.filter((p) => p.alive);
    const actions: FreeAction[] = [];

    for (const c of player.hand) {
      if (c.kind === CardKind.Weapon || c.kind === CardKind.Horse || c.kind === CardKind.Armor) actions.push({ kind: "equip", cardId: c.id });
    }

    const addPlayCard = (cards: Card[], cardKind: CardKind) => {
      for (const c of cards) actions.push({ kind: "playCard", cardId: c.id, cardKind });
    };

    if (slashesRemaining > 0 && !player.tianyiLostThisTurn && slashCandidates(alive, player).length > 0) {
      addPlayCard(allSlashLikeCards(player, this.aoChienActive), CardKind.Slash);
    }
    if (dismantlementCandidates(player, alive).length > 0) {
      addPlayCard(allDismantlementLikeCards(player), CardKind.Dismantlement);
    }
    if (snatchCandidates(player, alive).length > 0) {
      addPlayCard(player.hand.filter((c) => c.kind === CardKind.Snatch), CardKind.Snatch);
    }
    if (duelCandidates(player, alive).length > 0) {
      addPlayCard(allDuelLikeCards(player), CardKind.Duel);
    }
    if (fireAttackCandidates(player, alive).length > 0) {
      addPlayCard(allFireAttackLikeCards(player), CardKind.FireAttack);
    }
    if (collateralCandidates(player, alive).length > 0) {
      addPlayCard(player.hand.filter((c) => c.kind === CardKind.Collateral), CardKind.Collateral);
    }
    if (befriendAttackingCandidates(player, alive).length > 0) {
      addPlayCard(player.hand.filter((c) => c.kind === CardKind.BefriendAttacking), CardKind.BefriendAttacking);
    }
    addPlayCard(player.hand.filter((c) => c.kind === CardKind.IronChain), CardKind.IronChain);
    if (knownBothCandidates(player, alive).length > 0) {
      addPlayCard(player.hand.filter((c) => c.kind === CardKind.KnownBoth), CardKind.KnownBoth);
    }
    if (indulgenceCandidates(player, alive).length > 0) {
      addPlayCard(allIndulgenceLikeCards(player), CardKind.Indulgence);
    }
    if (supplyShortageCandidates(player, alive).length > 0) {
      addPlayCard(allSupplyShortageLikeCards(player), CardKind.SupplyShortage);
    }
    addPlayCard(player.hand.filter((c) => c.kind === CardKind.Lightning), CardKind.Lightning);
    addPlayCard(player.hand.filter((c) => c.kind === CardKind.AwaitExhausted), CardKind.AwaitExhausted);
    addPlayCard(player.hand.filter((c) => c.kind === CardKind.ExNihilo), CardKind.ExNihilo);
    addPlayCard(player.hand.filter((c) => c.kind === CardKind.SavageAssault), CardKind.SavageAssault);
    addPlayCard(player.hand.filter((c) => c.kind === CardKind.ArcheryAttack), CardKind.ArcheryAttack);
    addPlayCard(player.hand.filter((c) => c.kind === CardKind.GodSalvation), CardKind.GodSalvation);
    // Spear (weapon): offered independently of whether a real/viewAs Slash is also held --
    // real Sanguosha lets you choose either, not just fall back to this when out of Slashes.
    if (
      slashesRemaining > 0 &&
      !player.tianyiLostThisTurn &&
      player.weapon?.weaponName === "Spear" &&
      player.hand.length >= 2 &&
      slashCandidates(alive, player).length > 0
    ) {
      actions.push({ kind: "spearSlash" });
    }
    addPlayCard(player.hand.filter((c) => c.kind === CardKind.AmazingGrace), CardKind.AmazingGrace);
    if (player.isWounded() && !this.aoChienActive) {
      addPlayCard(player.hand.filter((c) => c.kind === CardKind.Peach), CardKind.Peach);
    }
    addPlayCard(player.hand.filter((c) => c.kind === CardKind.Analeptic), CardKind.Analeptic);

    for (const skill of player.skills) {
      if (usedSkillsThisTurn.has(skill.name)) continue;
      if (skill.selfAction) {
        actions.push({ kind: "selfAction", skillName: skill.name });
      } else if (skill.activeAction && skill.activeAction.candidatesFor(alive, player).length > 0) {
        actions.push({ kind: "activeAction", skillName: skill.name });
      }
    }

    return actions;
  }

  /** Milestone 5: hands `player`'s ENTIRE Play phase to an interactive loop -- present every
   *  legal action, wait for the player to pick one (or decline to end the phase), resolve it,
   *  and repeat. Only reachable when `controller.chooseFreeAction` is defined (human seats). */
  private async runFreeformPlayPhase(
    player: GamePlayer,
    controller: Controller & { chooseFreeAction: NonNullable<Controller["chooseFreeAction"]> },
  ): Promise<void> {
    let slashesAllowed = this.computeSlashLimit(player);
    let slashesUsed = 0;
    const usedSkillsThisTurn = new Set<string>();

    while (player.alive && !this.gameOver) {
      const legalActions = this.computeLegalActions(player, slashesAllowed - slashesUsed, usedSkillsThisTurn);
      const chosen = await controller.chooseFreeAction(player, legalActions);
      if (!chosen) return; // player ended their Play phase
      if (chosen.kind === "selfAction" || chosen.kind === "activeAction") usedSkillsThisTurn.add(chosen.skillName);
      if ((chosen.kind === "playCard" && chosen.cardKind === CardKind.Slash) || chosen.kind === "spearSlash") {
        if (await this.resolveFreeAction(player, chosen)) slashesUsed++;
      } else {
        await this.resolveFreeAction(player, chosen);
      }
    }
  }

  /** Resolves one `FreeAction` chosen via `chooseFreeAction`, reusing the exact same
   *  card-resolution helpers (`tryPlayOnce`/`tryPlayTargeted`/`tryPlaySlash`/`equip`) the fixed
   *  automatic pass uses -- same Weimu/hand-emptied/onTrickPlayed handling either way. Returns
   *  true if a Slash actually resolved (so the caller can decrement its per-turn count). */
  private async resolveFreeAction(player: GamePlayer, action: FreeAction): Promise<boolean> {
    if (action.kind === "equip") {
      const card = player.hand.find((c) => c.id === action.cardId);
      if (!card) return false;
      player.hand.splice(player.hand.indexOf(card), 1);
      await this.equip(player, card);
      await this.checkHandEmptied(player);
      return false;
    }
    if (action.kind === "selfAction") {
      const skill = player.skills.find((s) => s.name === action.skillName);
      if (!skill?.selfAction) return false;
      await skill.selfAction(this.makeContext(this.players.filter((p) => p.alive)), player, this.rng);
      this.onLiveUpdate?.();
      return false;
    }
    if (action.kind === "activeAction") {
      const skill = player.skills.find((s) => s.name === action.skillName);
      if (!skill?.activeAction) return false;
      const alive = this.players.filter((p) => p.alive);
      const candidates = skill.activeAction.candidatesFor(alive, player);
      if (candidates.length === 0) return false;
      const target = await this.controllers.get(player.id)!.chooseAnyPlayerTarget(player, candidates);
      if (!target) return false;
      await skill.activeAction.run(this.makeContext(alive), player, target, this.rng);
      this.onLiveUpdate?.();
      return false;
    }
    if (action.kind === "spearSlash") {
      return this.trySpearSlash(player);
    }

    // action.kind === "playCard"
    const card = player.hand.find((c) => c.id === action.cardId);
    if (!card) return false;
    switch (action.cardKind) {
      case CardKind.Slash:
        return this.tryPlaySlash(player, card);
      case CardKind.Dismantlement:
        await this.tryPlayTargeted(
          player,
          CardKind.Dismantlement,
          (alive) => dismantlementCandidates(player, alive),
          (_card, target, alive) => resolveDismantlement(this.makeContext(alive), player, target),
          () => card,
        );
        return false;
      case CardKind.Snatch:
        await this.tryPlayTargeted(
          player,
          CardKind.Snatch,
          (alive) => snatchCandidates(player, alive),
          (_card, target, alive) => resolveSnatch(this.makeContext(alive), player, target),
          () => card,
        );
        return false;
      case CardKind.Duel:
        await this.tryPlayTargeted(
          player,
          CardKind.Duel,
          (alive) => duelCandidates(player, alive),
          (_card, target, alive) => resolveDuel(this.makeContext(alive), player, target),
          () => card,
        );
        return false;
      case CardKind.FireAttack:
        await this.tryPlayTargeted(
          player,
          CardKind.FireAttack,
          (alive) => fireAttackCandidates(player, alive),
          (_card, target, alive) => resolveFireAttack(this.makeContext(alive), player, target),
          () => card,
        );
        return false;
      case CardKind.Collateral:
        await this.tryPlayTargeted(
          player,
          CardKind.Collateral,
          (alive) => collateralCandidates(player, alive),
          (_card, target, alive) => resolveCollateral(this.makeContext(alive), player, target),
          () => card,
        );
        return false;
      case CardKind.BefriendAttacking:
        await this.tryPlayTargeted(
          player,
          CardKind.BefriendAttacking,
          (alive) => befriendAttackingCandidates(player, alive),
          (_card, target, alive) => resolveBefriendAttacking(this.makeContext(alive), player, target),
          () => card,
        );
        return false;
      case CardKind.IronChain:
        await this.tryPlayTargeted(
          player,
          CardKind.IronChain,
          (alive) => ironChainCandidates(alive),
          (_card, target, alive) => resolveIronChain(this.makeContext(alive), target),
          () => card,
        );
        return false;
      case CardKind.KnownBoth:
        await this.tryPlayTargeted(
          player,
          CardKind.KnownBoth,
          (alive) => knownBothCandidates(player, alive),
          (_card, target, alive) => resolveKnownBoth(this.makeContext(alive), player, target),
          () => card,
        );
        return false;
      case CardKind.Indulgence:
        await this.tryPlayDelayedTrick(
          player,
          CardKind.Indulgence,
          (alive) => indulgenceCandidates(player, alive),
          (c, target) => attachIndulgence(this.makeContext(this.players.filter((p) => p.alive)), target, c),
          () => card,
        );
        return false;
      case CardKind.SupplyShortage:
        await this.tryPlayDelayedTrick(
          player,
          CardKind.SupplyShortage,
          (alive) => supplyShortageCandidates(player, alive),
          (c, target) => attachSupplyShortage(this.makeContext(this.players.filter((p) => p.alive)), target, c),
          () => card,
        );
        return false;
      case CardKind.Lightning:
        await this.tryPlayDelayedTrick(
          player,
          CardKind.Lightning,
          () => lightningCandidates(player),
          (c, target) => attachLightning(this.makeContext(this.players.filter((p) => p.alive)), target, c),
          () => card,
        );
        return false;
      case CardKind.ExNihilo:
        await this.tryPlayOnce(player, CardKind.ExNihilo, (alive) => alive, (_c, alive) => resolveExNihilo(this.makeContext(alive), player), card);
        return false;
      case CardKind.SavageAssault:
        await this.tryPlayOnce(
          player,
          CardKind.SavageAssault,
          (alive) => alive,
          (_c, alive) => resolveSavageAssault(this.makeContext(alive), player),
          card,
        );
        return false;
      case CardKind.AwaitExhausted:
        await this.tryPlayOnce(
          player,
          CardKind.AwaitExhausted,
          () => awaitExhaustedCandidates(player),
          (_c, alive) => resolveAwaitExhausted(this.makeContext(alive), player),
          card,
        );
        return false;
      case CardKind.ArcheryAttack:
        await this.tryPlayOnce(
          player,
          CardKind.ArcheryAttack,
          (alive) => alive,
          (_c, alive) => resolveArcheryAttack(this.makeContext(alive), player),
          card,
        );
        return false;
      case CardKind.GodSalvation:
        // No "someone must be wounded" gate here (unlike the bot pass) -- a human choosing to
        // play it is their own prerogative, even if it heals nobody.
        await this.tryPlayOnce(player, CardKind.GodSalvation, (alive) => alive, (_c, alive) => resolveGodSalvation(this.makeContext(alive)), card);
        return false;
      case CardKind.AmazingGrace:
        await this.tryPlayOnce(
          player,
          CardKind.AmazingGrace,
          (alive) => alive,
          (_c, alive) => resolveAmazingGrace(this.makeContext(alive), player),
          card,
        );
        return false;
      case CardKind.Peach:
        player.hand.splice(player.hand.indexOf(card), 1);
        this.discardPile.push(card);
        await this.checkHandEmptied(player);
        await resolvePeachSelfHeal(this.makeContext(this.players.filter((p) => p.alive)), player);
        this.onLiveUpdate?.();
        return false;
      case CardKind.Analeptic:
        player.hand.splice(player.hand.indexOf(card), 1);
        this.discardPile.push(card);
        await this.checkHandEmptied(player);
        resolveAnalepticBuff(this.makeContext(this.players.filter((p) => p.alive)), player);
        this.onLiveUpdate?.();
        return false;
      default:
        return false;
    }
  }

  /** Runs `player`'s own `otherPhaseAction` skills whose `phase` matches, gated by
   *  wantsToUseSelfAction (e.g. Ganfuren's Shenzhi at Start, Zhangliao's Tuxi at Draw). Runs
   *  BEFORE the phase's own default handling, so a hook can mutate state (e.g. Luoyi arming a
   *  reduced Draw-phase count) that the default handling then reads. */
  private async runOtherPhaseActions(player: GamePlayer, phase: Phase): Promise<void> {
    for (const skill of player.skills) {
      if (skill.otherPhaseAction?.phase !== phase || !player.alive || this.gameOver) continue;
      await skill.otherPhaseAction.run(this.makeContext(this.players.filter((p) => p.alive)), player, this.rng);
    }
  }

  /** Xiaoguo (Yuejin): fires on every OTHER alive player's matching skill at `player`'s own
   *  Finish phase. */
  private async runOtherPlayerFinishReactions(player: GamePlayer): Promise<void> {
    const ctx = this.makeContext(this.players.filter((p) => p.alive));
    for (const other of ctx.alivePlayers.filter((p) => p !== player)) {
      for (const skill of other.skills) await skill.otherPlayerFinishReaction?.(ctx, other, player, this.rng);
    }
  }

  /** Judge phase: resolves every delayed trick currently in `player`'s own judge area, in
   *  placement order, each removing itself before the next resolves (Indulgence/SupplyShortage
   *  never cycle back in on this repo's ported revision -- see their own resolve* functions;
   *  Lightning is the one exception -- a "good" judgment re-attaches it to the NEXT alive
   *  player's judge area instead, see `resolveLightningJudgment`). Stops early if the game ends
   *  or `player` dies mid-resolution (e.g. a retrial-triggered self-damage skill). */
  private async runJudgePhase(player: GamePlayer): Promise<void> {
    const ctx = this.makeContext(this.players.filter((p) => p.alive));
    while (player.judgeArea.length > 0 && player.alive && !this.gameOver) {
      const card = player.judgeArea.shift()!;
      if (card.kind === CardKind.Indulgence) await resolveIndulgenceJudgment(ctx, player, card);
      else if (card.kind === CardKind.SupplyShortage) await resolveSupplyShortageJudgment(ctx, player, card);
      else if (card.kind === CardKind.Lightning) await resolveLightningJudgment(ctx, player, card);
      this.onLiveUpdate?.();
    }
  }

  private async runPhase(player: GamePlayer, phase: Phase): Promise<void> {
    player.phase = phase;
    await this.runOtherPhaseActions(player, phase);
    // Discard-to-skip-a-phase (e.g. Xiahouyuan's Shensu, Zhang He's Qiaobian): checked
    // generically here so any future skill of this shape needs no runPhase changes of its own.
    // First matching skill wins (never 2 generals share this shape in practice).
    for (const skill of player.skills) {
      const cost = skill.skipsPhaseForDiscard?.(phase);
      if (!cost || player.handcardNum < cost.min) continue;
      if (!(await this.controllers.get(player.id)!.wantsToUseSelfAction(player, `${skill.name}-skip`))) continue;
      const ctx = this.makeContext(this.players.filter((p) => p.alive));
      const discarded = await ctx.askAnyHandCards(player, cost.min, cost.max);
      if (discarded.length < cost.min || discarded.length > cost.max) continue; // declined/invalid -- never forced
      if (cost.equipOnly && discarded.some((c) => c.kind !== CardKind.Weapon && c.kind !== CardKind.Horse && c.kind !== CardKind.Armor)) continue; // invalid choice -- decline
      for (const c of discarded) player.hand.splice(player.hand.indexOf(c), 1);
      this.discardPile.push(...discarded);
      this.log.push(
        discarded.length > 0
          ? `${player.id} bỏ ${discarded.length} lá, bỏ qua giai đoạn này (${skill.name})`
          : `${player.id} bỏ qua giai đoạn này (${skill.name})`,
      );
      await skill.onPhaseSkippedForDiscard?.(ctx, player, phase);
      this.onLiveUpdate?.();
      return; // the whole phase is genuinely skipped -- the switch below never runs
    }
    switch (phase) {
      case Phase.RoundStart:
        if (this.mode === GameMode.Hegemony) await this.runHegemonyReveal(player);
        break;
      case Phase.Judge:
        await this.runJudgePhase(player);
        break;
      case Phase.Start:
        break;
      case Phase.Draw: {
        if (player.forcedSkipDrawPhase) {
          // SupplyShortage (Xu Huang's Duanliang): a failed Judge-phase judgment already armed
          // this -- always skips, no ask, same precedent as Indulgence's forcedSkipPlayPhase.
          player.forcedSkipDrawPhase = false;
          this.log.push(`${player.id} bỏ qua giai đoạn rút bài (supply_shortage)`);
          break;
        }
        // Draw phase card count: 2 by default, raised/lowered by e.g. Yingzi/Luoyi (skill.ts).
        const drawBonus = player.skills.reduce((sum, skill) => sum + (skill.drawPhaseBonus?.(player) ?? 0), 0);
        const drawCount = Math.max(0, 2 + drawBonus);
        await this.controllers.get(player.id)!.wantsToDrawNow(player, drawCount);
        this.drawCards(player, drawCount);
        if (drawBonus !== 0) this.log.push(`${player.id} bốc ${2 + drawBonus} lá trong giai đoạn này (${drawBonus > 0 ? "yingzi" : "luoyi"})`);
        this.onLiveUpdate?.(); // the human seat's own draw-pile click is otherwise invisible to
        // spectators/other seats until the whole turn finishes -- broadcast the hand right away
        for (const skill of player.skills) {
          await skill.afterDrawPhase?.(this.makeContext(this.players.filter((p) => p.alive)), player, this.rng);
        }
        break;
      }
      case Phase.Play: {
        if (player.forcedSkipPlayPhase) {
          // Indulgence: a failed Judge-phase judgment already armed this -- always skips, no ask.
          player.forcedSkipPlayPhase = false;
          this.log.push(`${player.id} bỏ qua giai đoạn ra bài (indulgence)`);
          break;
        }
        // Fangquan (Liushan): may skip his own Play phase entirely -- gated by an ask, unlike
        // Keji's compulsory skipsDiscardPhase.
        const canSkip = player.skills.some((s) => s.canSkipPlayPhase?.(player));
        if (canSkip && (await this.controllers.get(player.id)!.wantsToUseSelfAction(player, "fangquan-skip"))) {
          this.log.push(`${player.id} bỏ qua giai đoạn ra bài (fangquan)`);
        } else {
          await this.runPlayPhase(player);
        }
        break;
      }
      case Phase.Discard:
        await this.discardDownToLimit(player);
        break;
      case Phase.Finish: {
        await this.runOtherPlayerFinishReactions(player);
        // Fangquan (Liushan): may grant another player (or himself) an immediate extra turn,
        // inserted before the normal seat rotation continues -- see playTurn()'s extraTurnQueue.
        const ctx = this.makeContext(this.players.filter((p) => p.alive));
        for (const skill of player.skills) {
          if (!skill.grantsExtraTurn) continue;
          const recipient = await skill.grantsExtraTurn(ctx, player);
          if (recipient) this.extraTurnQueue.push(recipient);
        }
        break;
      }
      case Phase.NotActive:
        break;
    }
  }

  /** Runs one full player turn (RoundStart..Finish) unless the game already ended mid-turn.
   *  Drains `extraTurnQueue` first (Fangquan) -- an extra-turn player doesn't touch
   *  `currentIndex`, so the normal rotation resumes exactly where it would have otherwise. */
  async playTurn(): Promise<void> {
    if (this.players.some((p) => !p.general)) {
      throw new Error("Room.pickGenerals() must complete (every player must have a general) before playTurn() runs");
    }
    const fromQueue = this.extraTurnQueue.length > 0;
    const player = fromQueue ? this.extraTurnQueue.shift()! : this.players[this.currentIndex];
    if (!player.alive) {
      if (!fromQueue) this.advanceToNextAlivePlayer();
      return;
    }
    this.turnNumber++;
    this.log.push(`--- Lượt ${this.turnNumber}: ${player.id} (${factionLabelVI(this.mode, player)}) ---`);
    // Jushou (Cao Ren): the REAL upstream RoundStart handler checks this before `player->play()`
    // even runs -- a face-down player just auto-flips back up and skips the ENTIRE turn (no
    // phases at all, not even a reveal ask), confirmed against gamerule.cpp's own EventPhaseStart
    // handling. `advanceToNextAlivePlayer` still runs below so the next seat's turn isn't skipped.
    if (player.faceDown) {
      player.faceDown = false;
      this.log.push(`${player.id} đang úp mặt, tự động lật lên và bỏ qua lượt này (jushou)`);
      if (!fromQueue) this.advanceToNextAlivePlayer();
      return;
    }
    player.playedSlashThisTurn = false;
    player.luoyiArmedThisTurn = false;
    player.tianyiWonThisTurn = false; // Tianyi (Taishici): any buff/ban from a PRIOR turn expires
    player.tianyiLostThisTurn = false;
    player.duelViewAsBlackAllowed = null;
    player.fixedDistanceTo.clear(); // Fenxun (Ding Feng): any distance override from a PRIOR turn expires
    for (const phase of PHASE_ORDER) {
      if (this.gameOver) return;
      await this.runPhase(player, phase);
    }
    player.phase = Phase.NotActive;
    if (!fromQueue) this.advanceToNextAlivePlayer();
  }

  private advanceToNextAlivePlayer(): void {
    const n = this.players.length;
    for (let step = 1; step <= n; step++) {
      const next = (this.currentIndex + step) % n;
      if (this.players[next].alive) {
        this.currentIndex = next;
        return;
      }
    }
  }

  /** Drives turns until a win condition fires or maxTurns is hit (safety valve for tests). */
  async runUntilGameOver(maxTurns: number): Promise<WinResult> {
    while (!this.gameOver && this.turnNumber < maxTurns) {
      await this.playTurn();
    }
    return this.gameOver;
  }
}
