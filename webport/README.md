# QSanguosha web port — status

Source of truth for porting: `github.com/Mogara/QSanguosha-For-Hegemony` (`dev` branch, C++/Qt,
GPLv3 + MCFR no-commercial code license; art assets in the parent repo are CC BY-NC-ND 4.0 —
non-commercial, no derivatives, self-host only).

## Milestone 0 — DONE (turn state machine + Role mode)

Core turn state machine + Role mode (Chủ công/Trung thần/Phản tặc/Nội gián), no cards/skills yet.

## Milestone 1 — DONE (basic-card combat + equip + core trick cards)

Real Slash/Jink/Peach/Analeptic + 8 trick cards + weapon/horse equip, replacing the placeholder deck.

- `src/types.ts` — `Phase`/`Place`/`Role` enums, ported 1:1 from `src/core/player.h` and
  `src/core/structs.h` names for later cross-checking against the C++ source.
- `src/gamerule.ts` — role-count table + win-condition check. **Not** ported from
  `engine.cpp::getRoles` (that table is degenerate in the public `dev` branch: 1 lord +
  (n-1) renegade, no loyalist/rebel). Uses the officially published Sanguosha role-mode table
  instead (sanguosha.cn `mode-info-1`).
- `src/room.ts` — per-player phase loop (RoundStart→Start→Judge→Draw→Play→Discard→Finish),
  draw/discard-pile flow with reshuffle, auto-equip pass (Weapon/Horse cards equip on hold,
  replacing the previous one into the discard pile), one attempt per held trick kind per turn,
  up to 1 Slash per turn (`Player::getSlashCount()` default), death → win-condition check.
  Mirrors `GameRule::onPhaseProceed` (`src/server/gamerule.cpp`).
- `src/card.ts` — card list + exact per-card suit/point ported 1:1 from this project's actual
  source (`standard-basics.cpp` basicCards(), `standard-tricks.cpp` trickCards(),
  `standard-equips.cpp` equipCards()), not the physical board game's box contents. Deck dealt =
  85 cards: 54 basics (Slash-family 29 incl. Fire/Thunder, Jink 14, Peach 8, Analeptic 3) +
  15 implemented trick cards + 16 equip cards (10 weapons + 6 horses).
- `src/combat.ts` — Slash → Jink resolution, dying → Peach self-rescue, horse-adjusted seat
  distance + weapon-based attack range (`Player::distanceTo`/`getAttackRange`). Naive
  random-target bot policy (no ally/enemy inference -- real alignment-aware AI is
  `lua/ai/*.lua` upstream, deferred).
- `src/trick.ts` — resolves AmazingGrace/GodSalvation/SavageAssault/ArcheryAttack/Duel/
  ExNihilo/Snatch/Dismantlement. **Explicitly excluded** (need the delayed-trick/judge-area
  system or a reactive Nullification counter-play stack, neither built yet): IronChain,
  FireAttack, Collateral, Nullification, HegNullification, AwaitExhausted, KnownBoth,
  BefriendAttacking, Indulgence, SupplyShortage, Lightning. All 4 Standard armors
  (EightDiagram/RenwangShield/Vine/SilverLion) are excluded too (need the trigger/skill system).

- `src/simulate.ts` — smoke tests (`npm run sim`): role distribution, card-conservation
  (now covers equip slots too), scripted win-condition checks, an **emergent** end-to-end game
  (no scripted damage) that reaches a real win via Slash/Jink/Peach + the bot policy alone, and
  a coverage test confirming every implemented equip/trick effect actually fires through real
  play (scans logs across 40 seeds for each kind's marker). All passing.

## Milestone 1.6 — folded into Milestone 2.6 (see below)

- The 11 excluded trick cards + 4 armors above (needs delayed-trick/judge-area system +
  reactive counter-play stack for Nullification).
- Weapon/armor *active abilities* (Crossbow multi-slash, Qinggang armor-ignore, Axe force-hit,
  EightDiagram judgment-dodge, ...) -- currently only numeric range/distance is modeled; these
  need the same event-bus work as scaling past 3 generals (Milestone 2.6), so folded in there.

## Milestone 2 — DONE (3 generals, typed skill hooks)

3 of the 27 Standard generals ported, with a small typed hook system (not yet a generic
events<<.../triggerable/cost/effect trigger bus like `src/core/skill.h`'s `TriggerSkill` -- see
`src/skill.ts` header for why that's deferred).

- `src/skill.ts` — `Skill` interface (`slashLimit`, `canViewAsSlash`, `onDamaged` hooks) +
  3 generals ported from `standard-{shu,wei}-generals.cpp`, Hegemony-only branches (dual-general
  "shouyue" gating) stripped: **Paoxiao** (Zhang Fei, shu, 4hp: no Slash-per-turn cap),
  **Wusheng** (Guan Yu, shu, 5hp: any red hand card playable as Slash), **Ganglie** (Xiahou Dun,
  wei, 4hp: on taking damage, judge a card; if not Heart, the damage source discards 2 or takes
  1 -- source's refusal-to-discard branch simplified to "discard if it has >=2 cards, else take
  damage", since refusal needs alignment-aware AI this milestone doesn't have).
- `src/room.ts` — generals sampled with replacement per player (maxHp/initial hand size now vary
  4/5 by general instead of a flat 4), `triggerOnDamaged` hook wired through `combat.ts`'s
  `applyDamage`, Slash-limit and Slash-like-card search now skill-aware.
- **Bug found and fixed by this milestone's own tests**: `tryPlayOnce` captured a played card's
  hand index before running its effect; Duel's alternating-Slash resolution can splice further
  cards out of the *actor's own* hand mid-resolution (when the actor is pulled in as the
  responder), which shifted indices and caused the played Duel card to be discarded AND left in
  hand (a real duplicate `Card` object reference, caught by `testPhaseCyclingConservesCards`'
  conservation check going 87 != 85). Fixed by having `tryPlayOnce` select the target/validity
  first (pure, no mutation), then splice+discard the played card, then run the effect.
- `src/simulate.ts` — `testGeneralSkillsAppearInPlay`: confirms all 3 generals get assigned and
  each skill's effect fires through real play (multi-slash turn, a non-Slash card resolved as
  Slash, the Ganglie judge log, and its discard-2 branch) across 60 seeds. All 7 tests passing.

## Milestone 2.6 — DONE (44 of 46 investigated Standard generals ported)

14 of 27 Standard generals now ported (up from 3). `skill.ts`'s typed hook system grew to 8
hook points instead of graduating to a full event bus yet -- still cheaper than the generic
bus for the shapes needed so far, see `skill.ts`'s header for why.

- `src/skill.ts` -- `Skill` interface gained `canViewAsJink`, `immuneToSlashAndDuel`, and
  `onSlashTargeted` (fired per attacker skill right after a Slash targets someone, before the
  Jink check -- returning true blocks that Jink outright). 4 more generals ported from
  `standard-{shu,wei}-generals.cpp`: **Longdan** (Zhao Yun, shu, 4hp: a held Slash can be
  played/discarded as Jink and vice versa), **Qingguo** (Zhen Ji, wei, 3hp: a held black card
  can be played/discarded as Jink), **Kongcheng** (Zhuge Liang, shu, 3hp: immune to being
  targeted by Slash/Duel while holding no cards -- simplified from the real optional
  `askForSkillInvoke` to automatic, see `skill.ts`'s header), **Tieqi** (Ma Chao, shu, 4hp: on
  Slash-targeting, judge a card; if red, that Slash can't be dodged -- same optional-to-automatic
  simplification as Kongcheng). lang/vi_VN's `:kongcheng`/`:longdan`/`:tieqi` entries describe a
  different (likely newer) skill revision than what this repo's `dev`-branch C++ actually
  implements for all 3 -- not ported; official skill *names* were kept, descriptions were
  written to match the real ported behavior instead (see `skill.ts` header for specifics).
  Guanxing (Zhuge Liang's 2nd skill, needs card-reorder UI) and Mashu (Ma Chao's 2nd skill, a
  horse-distance modifier) deferred.
- `src/combat.ts` -- `findSlashLikeCard`/new `isImmuneToSlashAndDuel` exported (were/are also
  used by `room.ts`'s own-turn Slash search and `controller.ts`/`trick.ts`'s candidate lists);
  new `findJinkLikeCard` (dodge-side counterpart, viewAs-aware); `resolveSlash` now runs each
  attacker skill's `onSlashTargeted` before the Jink search.
- `src/controller.ts`/`src/trick.ts` -- `slashCandidates`/`duelCandidates` now filter out
  `isImmuneToSlashAndDuel` targets (Kongcheng). `trick.ts`'s `resolveDuel` now sources its
  Slash search through `findSlashLikeCard` (viewAs-aware, e.g. Longdan) instead of a raw
  `CardKind.Slash` check, so Duel's forced exchange respects the same viewAs skills as a normal
  turn.
- `src/simulate.ts` -- `testGeneralSkillsAppearInPlay` expanded to all 7 generals plus Tieqi's
  judge/block markers over 60 seeds; 3 new pure/deterministic tests since Kongcheng's
  hand-empty-dependent filter and Tieqi's judge-draw-dependent block are too rare to reliably
  log-mine: `testKongchengImmunity` (direct `slashCandidates`/`duelCandidates` check),
  `testTieqiBlocksDodge` and `testViewAsJinkDodges` (both drive `resolveSlash` directly with a
  hand-built `EngineContext`, no `Room` needed).

**4 more generals, 3 more hook types.** `skill.ts` gained `immuneToSnatch`, `onDamageDealt`, and
`selfAction`; `combat.ts` gained `loseHp` (a self-inflicted hp loss distinct from damage -- no
`onDamage`/`onDamageDealt` skill trigger, but still runs the dying/Peach-rescue check, crediting
no side: `killerRole` is now `Role | null` everywhere it flows). 4 more generals ported from
`standard-{shu,wei,wu}-generals.cpp`:
- **Fankui** (Sima Yi, wei, 3hp): `onDamaged`, take 1 random card off the damage source's hand
  (matches lang/vi_VN's `:fankui` exactly, unlike the 3 mismatches above). Equip-card stealing
  ("he" in the real rule) not modeled, same hand-only simplification Snatch/Dismantlement use.
- **Kurou** (Huang Gai, wu, 4hp): new `selfAction` hook -- once per Play phase, may lose 1 hp
  then draw 2 cards (`Controller.wantsToUseSelfAction`, gated ahead of the other tricks so any
  cards it draws are available for the rest of the phase). Can kill at 1 hp; that death credits
  no side via the new `loseHp`. lang/vi_VN's `:kurou` describes a richer revision (discard a
  card first, draw 3 not 2, +1 Slash limit) not in this repo's `dev`-branch `KurouCard` -- not
  ported, same newer-revision mismatch pattern as Longdan/Kongcheng/Tieqi.
- **Qianxun** (Lu Xun, wu, 3hp): new `immuneToSnatch` hook, wired into `snatchCandidates`
  (`trick.ts`) the same way Kongcheng gates `slashCandidates`/`duelCandidates`. Only the
  Snatch-immunity half of the real skill is ported; the other half (discard Indulgence on
  entering his judge area) needs the delayed-trick/judge-area system, still out of scope.
- **Kuanggu** (Wei Yan, shu, 4hp): new `onDamageDealt` hook (source-side counterpart to
  `onDamaged`, fired from `applyDamage` for the ATTACKER's skills) -- after dealing damage to a
  target within distance 1 while wounded, automatically recovers 1 hp per point of damage dealt
  (capped at maxHp). lang/vi_VN's `:kuanggu` describes a per-point CHOICE between recovering or
  drawing a card; this repo's `dev`-branch `Kuanggu::effect` only implements the recover branch
  -- ported as-is, same newer-revision mismatch pattern as above.
- `src/server.ts`/`public/index.html` -- new `confirmSelfAction` Yes/No message type for Kurou
  (`{type, actorId, skillName, skillDisplayName, skillDescription}` out, same `askClient()`
  plumbing, defaults to `true` on timeout like the other resource-choice asks), rendered via the
  existing `showConfirm()` using the acting player's own general avatar as the icon (client now
  tracks the latest state snapshot in `lastState` to look up that avatar).
- `src/simulate.ts` -- `testGeneralSkillsAppearInPlay` expanded to 11 generals plus Fankui/Kurou/
  Kuanggu log markers; `testQianxunImmunity` (parallel to `testKongchengImmunity`, direct
  `snatchCandidates` check); `testKurouSelfInflictedDeathCreditsNoKiller` (drives `loseHp`
  directly, proving a self-inflicted death credits no side).
- **Verification:** unit/integration tests above (18/18 passing); a live `ws` client observed a
  real `confirmSelfAction` request with the exact expected shape and successfully answered it
  end-to-end without stalling the server; a second live `ws` client confirmed all 11 generals
  are actually sampled by the running server. Browser screenshot confirmed avatar + skill-panel
  rendering for 4 of the newly ported generals (Long Đảm/Cương Liệt/Khuynh Quốc/Võ Thánh) with no
  layout breakage.
- **Remaining for this milestone:** the other 13 Standard generals, plus Guanxing/Mashu/Duoshi/
  Guicai/Fanjian above. Graduating `skill.ts` to a full event bus is still deferred until a
  general actually needs a hook shape these 14 don't (proactive skills needing target-picking
  UI, skills that modify other players' cards/targets, cross-player pre-damage target choices
  like Jieming/Fangzhu, delayed-trick/judge-area-dependent skills like Guicai/Qianxun's
  Indulgence half, etc.) -- see Milestone 1.6's note for the same boundary on tricks/armors/
  weapon-active-abilities.
- 18 tests total, all passing.

**3 more generals, 2 more hook types.** `skill.ts` gained `canViewAsDismantlement` and
`drawPhaseBonus`; `combat.ts` gained `findDismantlementLikeCard` (viewAs-aware, parallel to
`findSlashLikeCard`); `room.ts`'s `tryPlayTargeted` now takes an optional `findCard` override
(defaults to the old raw-`CardKind` search) so Dismantlement can search viewAs-aware without
touching Snatch/Duel's call sites. 3 more generals ported from
`standard-{wei,wu}-generals.cpp`:
- **Jianxiong** (Cao Cao, wei, 4hp): `onDamaged`, obtain the card that dealt the damage (matches
  lang/vi_VN's `:jianxiong` exactly, unlike several mismatches above). This repo's `onDamage`
  hook doesn't thread the specific damage-dealing card through, so it's approximated as "take
  the top of the discard pile" -- correct in practice, since Slash/Duel/AOE resolution always
  pushes its card there immediately before `applyDamage` runs.
- **Yingzi** (Zhou Yu, wu, 3hp): new `drawPhaseBonus` hook, wired into `room.ts`'s Draw-phase
  card count (default 2, +1 here) -- simplified from the real optional `askForSkillInvoke` to
  automatic, same reasoning as Kongcheng/Tieqi. Zhou Yu's other skill, Fanjian (give a card,
  target guesses its suit), needs a new suit-guessing ask type -- deferred.
- **Qixi** (Gan Ning, wu, 4hp): new `canViewAsDismantlement` hook -- any held black card can be
  played/discarded as Dismantlement (matches lang/vi_VN's `:qixi` exactly). Dismantlement
  already has no distance restriction in this engine, so Qixi's real "ignores distance" clause
  needed no separate modeling.
- `src/simulate.ts` -- `testGeneralSkillsAppearInPlay` expanded to 14 generals plus
  Jianxiong/Yingzi/Qixi log markers over the same 60 seeds.
- **Verification:** typecheck clean; 18/18 tests passing (marker count grew, test count didn't --
  no new hand/distance-dependent filter needing a dedicated deterministic test this round).
- **Remaining for this milestone:** the other 13 Standard generals, plus Guanxing/Mashu/Duoshi/
  Guicai/Fanjian above (same list as before this batch).
- 18 tests total, all passing.

**Final batch — 30 more generals (14→44), Milestone 2.6 DONE.** A read-only classification pass
(`grep`/read every remaining Standard general's skill class across `standard-{shu,wei,wu,qun}.cpp`
against this repo's typed hook system) sorted the other 32 assigned generals into 31 PORTABLE
(at least one skill portable via a small new hook) and 15 BLOCKED (every skill needs a genuine
new subsystem: judge-area/delayed-tricks, armor, gender, face-up/down state, marks/limit-counters,
multi-card viewAs, pindian card-compare, dual-general head/deputy show/hide, equip-stealing, or
multi-target/turn-order/phase-skip mechanics). **One correction found while porting:** the initial
pass classified Dingfeng's Duanbing as `PORTABLE_EXISTING` (assumed "Slash within distance 1
can't be dodged", same shape as Tieqi); re-reading its actual `dev`-branch source (`wu.cpp`) shows
`Duanbing::triggerable()` is an empty no-op with a `// Slash::targetFilter()` comment, and
lang/vi_VN's official text confirms the real effect is "after targeting with Slash, may designate
1 more target within distance 1" — a genuine multi-target-Slash extension, needing the same
not-yet-built multi-target Slash resolution as Xiahouyuan's Shensu. **Dingfeng is correctly left
unported**, making the final tally 30 portable + 16 blocked of the 46 investigated generals.
`skill.ts` gained ~20 more hook points (`onIncomingSlash`, `responseCountRequired`,
`onSlashDodged`, `bonusDamage`, `reduceDamage`, `immuneToSavageAssault`, `hijackAoeSource`,
`retainsCardAfterPlay`, `ignoresTrickDistanceLimit`, `onTrickPlayed`, `otherPhaseAction`,
`skipsDiscardPhase`, `onEquipLost`, `onOtherPlayerOverDiscard`, `activeAction`,
`canViewAsPeach`, `canViewAsDuel`, `onHandEmptied`, `onAllyDying`/`onAllyDeath`, `onRecover`,
`onDeathClaimCards`, `otherPlayerFinishReaction`, `immuneToBlackTrick`, `attackDistanceDelta`),
a generic `chooseAnyPlayerTarget` Controller ask, and an ally-concept helper (`gamerule.ts`'s
`alliesOf`, same role/kingdom check `Skill`'s ally-scoped hooks and `Controller`'s ally-filtered
asks share). 30 generals ported across all 4 kingdoms:
- **Shu (6):** Huangyueying (Jizhi/Qicai), Huangzhong (Liegong), Liushan (Xiangle), Menghuo
  (SavageAssaultAvoid/Huoshou), Zhurong (SavageAssaultAvoid/Juxiang), Ganfuren (Shushen/Shenzhi).
- **Wei (7):** Zhangliao (Tuxi), Xuchu (Luoyi), Guojia (Yiji), Dianwei (Qiangxi), Xunyu
  (Jieming), Caopi (Xingshang), Yuejin (Xiaoguo).
- **Wu (6):** Lvmeng (Keji), Daqiao (Liuli), Sunshangxiang (Xiaoji), Sunjian (Yinghun), Lusu
  (Haoshi), Erzhang (Guzheng).
- **Qun (11):** Huatuo (Jijiu/Qingnang), Lvbu (Wushuang), Diaochan (Biyue), Yanliangwenchou
  (Shuangxiong), Jiaxu (Weimu), Pangde (Mashu/Mengjin), Zhangjiao (Leiji), Caiwenji (Beige),
  Mateng (Mashu), Kongrong (Mingshi), Tianfeng (Sijian/Suishi).

  Every general's `GeneralDef` comment documents which sibling skill(s) were deferred and why
  (see `skill.ts`'s `GENERALS` array) -- same one-line-per-deferral convention used since
  Milestone 2's first 3 generals.
- **Bug found and fixed by writing `testWushuangRequiresTwoJinks`:** `combat.ts`'s `resolveSlash`
  tentatively removed cards from hand as it searched for a multi-Jink set (Wushuang needs 2), but
  discarded whatever it had found even when the full set wasn't available -- so a Wushuang target
  holding only 1 of the 2 required Jinks lost that Jink for nothing on a failed dodge attempt.
  Fixed to only discard the spent cards once the full `responseCountRequired` set is confirmed;
  an incomplete attempt now returns the tentatively-removed card(s) to hand untouched, matching
  the real rule that an unplayable response set was never actually played.
- Avatar assets for all 44 generals confirmed present under `image/generals/avatar/`; 2 were
  missing (Erzhang, Yanliangwenchou -- both "combo" generals representing 2 historical figures,
  which the original asset pack only ships as `big`/`small`/`kof`/`fulldual` art, never a
  standalone circular `avatar` crop) and were synthesized by cropping+resizing the top of their
  existing `big` portrait art to the avatar aspect ratio (both figures stay visible). Official
  Vietnamese general/skill names confirmed present in `lang/vi_VN/Package/Standard*General.lua`
  for all 30.
- `src/simulate.ts` -- `testGeneralSkillsAppearInPlay` expanded to all 44 generals and 42 log
  markers (log-mined across 150 seeds). 5 new dedicated deterministic tests for skills too
  passive/rare to reliably log-mine: `testQicaiIgnoresSnatchDistance`, `testMashuReducesDistance`,
  `testSavageAssaultAvoidImmunity`, `testLiegongBlocksJink`, `testWushuangRequiresTwoJinks`
  (the one that caught the bug above). Kongcheng/Qianxun keep their own pre-existing dedicated
  tests. 21 tests total, all passing.
- **Verification, three layers:**
  1. `npx tsc --noEmit` clean; `npm run sim` 21/21 passing.
  2. Live `ws` client: 15 fresh games sampled 41 of the 44 generals (including both synthesized-
     avatar combo generals), confirming the server's real random sampling actually reaches the
     full new roster, not just the type-checked `GENERALS` array.
  3. Real headless-browser run against `public/index.html`: an 8-player game rendered all 8
     avatars correctly (no broken-image fallback triggered) with real Vietnamese skill
     descriptions for newly-ported generals (Mateng/Pangde's Mã Thuật, Caopi's Hình Thưởng,
     Zhuge Liang's Không Thành, Zhou Yu's Anh Tụ), and the live battle log showed a newly-ported
     skill actually firing mid-game (`P3 discards a card (mengjin)`).
- **Remaining unported (16 of 46 investigated):** Pangtong, Wolong, Xiahouyuan, Zhanghe, Xuhuang,
  Caoren, Sunquan, Xiaoqiao, Taishici, Zhoutai, Yuanshao, Jiling, Panfeng, Zoushi, and now
  Dingfeng (see the correction above) -- each needs a genuine new subsystem (judge-area/
  delayed-tricks, armor, gender, face-up/down state, marks/limit-counters, multi-card viewAs,
  pindian, dual-general head/deputy show/hide, equip-stealing, or multi-target/phase-skip
  mechanics), consistent with every other deferred skill noted throughout this milestone.
  Guanxing/Duoshi/Guicai/Fanjian (from the first 14 generals) remain deferred for the same
  reasons noted when they were first documented above.

## Milestone 3 — DONE (spectator server, all-bot)

Proves the actual "web" part of the request end to end: the Node game engine now runs behind a
WebSocket server and a browser client renders it live.

- `src/server.ts` — `ws` WebSocket server (`npm run server`, port 8787). Runs one Room, calls
  `playTurn()` every 500ms, broadcasts a JSON snapshot to every connected client. Fog of war:
  `role` is `null` in the snapshot until `roleShown` (mirrors `Player::hasShownRole` --
  spectators can't see hidden identities either).
- `public/index.html` — plain HTML/CSS/JS (no build step) card-table view: 8 player cards with
  HP hearts, role badge (hidden until revealed), general, equipment, hand count, current-turn
  highlight, scrolling log, game-over banner.
- **Verification:** a real `ws` client received correctly shaped, live-updating snapshots. A
  browser-rendered screenshot was blocked at the time by a local Chromium/Playwright version
  mismatch; confirmed working once that was resolved during Milestone 3.5 (see below).

## Milestone 3.5 — DONE (human-controlled seat)

A human can now actually play: claim a seat over WebSocket and control its Slash-target
decisions live, while every other seat stays bot-controlled.

- `src/controller.ts` — `Controller` interface (`chooseSlashTarget`), `makeBotController` (the
  same naive random-target policy every seat used before), `slashCandidates` (extracted from the
  old `botChooseSlashTarget`).
- `src/room.ts` — `playTurn`/`runPhase`/`runPlayPhase`/`runUntilGameOver` are now `async`; the
  Slash-target decision goes through `this.controllers.get(player.id).chooseSlashTarget(...)`
  instead of always calling the bot function directly. That milestone's `Room.setController`
  swapped a seat's decision-maker at runtime (`null` reverts to bot) -- Slash-target was the ONLY
  thing a human seat controlled at the time; equip and which-trick-to-play stayed bot-driven
  even for a claimed seat until Milestone 3.6 (below).
- `src/server.ts` — `makeHumanController(playerId)`: on `chooseSlashTarget`, sends a
  `{type:"chooseSlashTarget", requestId, candidateIds, timeoutMs}` request to the claiming
  client's socket and awaits a correlated `{type:"response", requestId, targetId}` (15s timeout
  -> pass, matching a human just not acting). New message protocol: `{type:"new"}` resets the
  game, `{type:"claim"/"unclaim", playerId}` takes/releases a seat, released automatically on
  disconnect. The turn loop switched from a fixed `setInterval` to a self-rescheduling
  `await room.playTurn(); setTimeout(loop, 500)` -- required once `playTurn()` can pause for
  up to 15s waiting on a human, so turns can never overlap/race.
- `public/index.html` — "Chiếm ghế" (claim) button per living unclaimed seat, a decision banner
  ("`P1: bạn muốn Sát ai?`") with candidate players highlighted as clickable and a "Bỏ qua"
  (pass) button.
- **Bug found and fixed by manual testing**: the client never cleared its local `mySeat` variable
  on "New game", so after a reset it still rendered "this is your seat" for a seat the server had
  already released -- the claim button never reappeared. Fixed by resetting `mySeat`/prompt state
  in the "New game" click handler to match the server-side `releaseSeatsHeldBy` it triggers.
- **Verification, two layers:**
  1. A Node `ws` client claimed a seat, received a `chooseSlashTarget` request, answered with a
     specific target, and the broadcast log showed that EXACT target being slashed.
  2. Real headless-browser (Playwright/gstack `browse`) run: navigated to `public/index.html`,
     clicked "Chiếm ghế" for P1, waited for the decision banner to render, clicked a highlighted
     candidate player card, and confirmed via screenshot + log diff that `P1 slashes P2` (the
     exact card clicked) appeared. Screenshots captured at every step.
- `src/simulate.ts` — `testHumanControllerOverridesBot`: installs a controller that always
  declines to slash on P1, runs a full game, asserts P1 never attacks while every other
  (bot-controlled) seat does.

## Milestone 3.6 — DONE (equip / trick / dodge / peach control)

Expanded the human seat from 1 decision to 5: equip, trick usage (yes/no for the AOE/self
tricks), Slash target, Jink dodge, Peach self-rescue. Manual target selection for
Dismantlement/Snatch/Duel and Duel's forced-Slash exchange were still bot-driven at this point
-- see Milestone 3.7 below and `controller.ts`'s header for the boundary as it stands now.

- `src/controller.ts` -- `Controller` gained `wantsToEquip`, `wantsToPlayTrick`, `wantsToDodge`,
  `wantsToUsePeach`. `Room.setController` now takes `Partial<Controller>` merged over
  `makeBotController`'s defaults, so a seat (or a test) only needs to override what it cares
  about.
- `src/combat.ts` -- `resolveSlash`/`applyDamage`/`resolveDying` are now `async` and ask
  `ctx.askDodge`/`ctx.askPeach` (only when the player actually holds the relevant card) instead
  of always auto-using it. `src/trick.ts`'s `resolveDuel`/`resolveSavageAssault`/
  `resolveArcheryAttack` and `src/skill.ts`'s Ganglie hook became `async` to match (they call
  `applyDamage`). `src/room.ts`'s equip pass and `tryPlayOnce` (trick-card gate) now `await` a
  `wantsToEquip`/`wantsToPlayTrick` check before committing the card.
- `src/server.ts` -- generalized the old single-purpose `chooseSlashTarget` request/response into
  `askClient()`, a small helper reused for 4 new Yes/No message types: `confirmEquip`,
  `confirmTrick`, `confirmDodge`, `confirmPeach` (each `{type, requestId, actorId, ...}` out,
  `{type:"response", requestId, value:boolean}` back). Per-ask timeout fallback: offensive/
  optional actions (Slash, trick) default to declining; protective actions (equip, dodge, peach)
  default to happening, since silently refusing self-protection isn't a sensible "no answer"
  default.
- `public/index.html` -- `showConfirm()` renders a shared Yes/No scroll modal (real card art:
  the specific equip icon, the trick's card image, Jink/Peach art) with "Đồng ý"/"Không" buttons,
  reused by all 4 new prompt types plus the existing Slash-target picker.
- **Verification, three layers:**
  1. `src/simulate.ts`'s `testExpandedControllerHooksRespected`: a controller that declines all
     4 new hooks on P1, across 40 seeds, never equips/self-sources-a-trick/dodges/self-heals in
     the log, while every other (bot, always-accepts) seat still does all 4 normally.
  2. Raw `ws` client: claimed a seat, answered a live sequence of real `confirmEquip` ->
     `confirmTrick` (declined) -> `chooseSlashTarget` -> `confirmDodge` -> ... prompts in order,
     confirming the request/response protocol round-trips correctly for all 4 new types.
  3. Real headless-browser run: claimed a seat, a `confirmEquip` modal rendered with the actual
     weapon's card art and "Đồng ý"/"Không" buttons, clicking "Đồng ý" closed it and the game
     continued to the next live decision. Screenshots captured.

## Milestone 3.7 — DONE (manual target selection for Dismantlement/Snatch/Duel)

A human seat now picks WHO to target with the 3 single-target tricks, not just whether to play
them (Milestone 3.6 only offered yes/no, with the bot always choosing the target internally).

- `src/trick.ts` -- `pickDismantlementTarget`/`pickSnatchTarget`/`pickDuelTarget` (single
  random pick + `rng` param) replaced by `dismantlementCandidates`/`snatchCandidates`/
  `duelCandidates` (return the full legal-target list; no `rng`). The random pick moved into
  `controller.ts`'s bot default.
- `src/controller.ts` -- `Controller` gained `chooseTrickTarget(player, kind, candidates)`,
  parallel to `chooseSlashTarget`. `wantsToPlayTrick` now only covers the AOE/self tricks
  (SavageAssault/ArcheryAttack/GodSalvation/AmazingGrace/ExNihilo), which have no target to pick.
- `src/room.ts` -- new `tryPlayTargeted()` (parallel to `tryPlayOnce`): asks
  `chooseTrickTarget` for a specific player instead of a plain yes/no gate, used for
  Dismantlement/Snatch/Duel.
- `src/server.ts` -- new `chooseTrickTarget` message type (candidate id list out, chosen
  `targetId` back), same `askClient()` plumbing as `chooseSlashTarget`.
- `public/index.html` -- the Slash-target picker UI generalized into `showTargetPicker()` and
  reused for `chooseTrickTarget` (same candidate-highlighting/click mechanism, different
  card-art image and title per trick kind).
- **Verification:**
  1. `src/simulate.ts`'s `testChooseTrickTargetPicksExactPlayer`: a controller that always picks
     the *last* candidate for Duel, across 40 seeds, confirms that exact chosen player's id
     appears in the `P1 duels <id>` log line.
  2. Raw `ws` client: observed real `chooseTrickTarget` requests for both `dismantlement` and
     `duel` with correct candidate-id lists, and confirmed `confirmTrick` (yes/no) still fires
     separately for the AOE tricks (`ex_nihilo`, `savage_assault`) -- proving the kind-based
     split between the two Controller methods works end-to-end over the wire.
- 10 tests total, all passing.

## Milestone 3.8 — DONE (Duel's Slash exchange + Ganglie's discard-or-damage choice)

The last 2 documented gaps from Milestone 3.7 are closed: Duel no longer auto-plays a held
Slash, and Ganglie's damage source no longer auto-discards -- both are now real per-player
decisions.

- `src/controller.ts` -- `Controller` gained `wantsToPlaySlashInDuel` and
  `wantsToDiscardForGanglie`. Bot defaults both to `true`, matching the exact pre-3.8 automatic
  behavior (no behavior change for bot-controlled seats).
- `src/combat.ts` -- `EngineContext` gained `askDuelSlash`/`askGanglieDiscard`, parallel to the
  existing `askDodge`/`askPeach`.
- `src/trick.ts` -- `resolveDuel` now checks `ctx.askDuelSlash(responder)` before taking a held
  Slash; declining (or not holding one) ends the exchange with 1 damage immediately, matching
  the real rule that playing Slash in a Duel is optional even when held.
- `src/skill.ts` -- Ganglie's `onDamaged` now checks `ctx.askGanglieDiscard(source)` (only when
  `source.handcardNum >= 2`) before discarding 2 cards; declining (or having <2 cards) deals 1
  damage instead.
- `src/server.ts` -- 2 new Yes/No message types, `confirmDuelSlash` and `confirmGanglieDiscard`,
  same `askClient()` plumbing, default-to-`true` on timeout (protective/optional-resource
  actions, same policy as dodge/peach).
- `public/index.html` -- both reuse `showConfirm()` with Slash/Dismantlement card art.
- **Verification:**
  1. `src/simulate.ts`'s `testDuelSlashAndGanglieDiscardRespected`: a controller declining both
     on P1, across 60 seeds, never plays a Slash mid-Duel or discards for Ganglie in the log,
     while some other (bot) seat still does each normally.
  2. Raw `ws` client: observed real `confirmDuelSlash` and `confirmGanglieDiscard` requests
     (across two separate runs, since which one fires depends on the random deal) with the
     expected `{type, actorId, requestId, timeoutMs}` shape.
- 11 tests total, all passing.

## Milestone 4 — DONE (multi-room lobby + Vietnamese general names)

`server.ts` no longer runs a single global game shared by every connected client -- a connecting
client starts in a lobby, sees a live list of open rooms, and either creates a new one (5-10
players) or joins an existing one. Also: every player card now shows the general's real
Vietnamese name, not the internal pinyin id.

- `src/skill.ts` -- `GeneralDef` gained `displayName` (the official Vietnamese name from
  `lang/vi_VN/Package/Standard*General.lua`, e.g. `"caocao"` -> `"Tào Tháo"`), populated for all
  44 ported generals. `src/player.ts` -- `GamePlayer` gained `generalName`, set alongside
  `general` in `Room`'s constructor. `src/server.ts`'s snapshot now includes `generalName`;
  `public/index.html` displays it (player card, hero panel) while `general` (the pinyin id)
  stays the source for avatar/asset filenames, which are untranslated.
- `src/server.ts` -- replaced the single module-level `room`/`clients`/`claimedSeats` state with
  a `Map<roomId, GameRoom>` (`id`, `room`, `clients`, `claimedSeats`, `pendingRequests`,
  `loopTimer`) plus a `Map<WebSocket, GameRoom>` tracking which room (if any) each socket is
  watching -- absent from that map means "in the lobby". New message types: `listRooms` (request
  a fresh list), `createRoom` (`{playerCount}`, validated 5-10, matching `gamerule.ts`'s role
  table), `joinRoom` (`{roomId}`), `leaveRoom`. The existing `new`/`claim`/`unclaim`/`response`
  types now resolve against the sender's *current* room instead of a single global one. Every
  room runs its own independent `playTurn()` timer from creation; the room is torn down (timer
  cleared, state dropped) the moment its last watching client leaves, so abandoned rooms don't
  linger. The state snapshot gained an explicit `type:"state"` field (previously untyped,
  distinguished only by NOT matching any of the known prompt-type strings) so the client can
  route it unambiguously against the new `roomList`/`error` message types.
- `public/index.html` -- new lobby panel (room list + player-count selector + "Tạo phòng mới")
  shown before joining a table, toggled against the existing game-table view via `showLobbyView`/
  `showGameView`. Header gained a room-code label and a "Rời phòng" button.
- **Bug found and fixed while verifying the leave-room flow**: the body restructuring for the
  lobby/game-view split accidentally dropped the `#promptOverlay`/`#prompt` divs from the HTML
  (an editing mistake, not a design issue). Every `Controller` prompt handler
  (`showTargetPicker`/`showConfirm`/`answerPrompt`) still referenced the now-missing elements, so
  `showLobbyView()` threw on its very first DOM write (`promptOverlayEl.className = ""` on a
  `null` element) and silently aborted mid-function -- "Rời phòng" looked like it did nothing.
  Root-caused via `window.__trace`-based instrumentation (console capture doesn't reach this
  headless harness) that isolated the exact throwing line; fixed by restoring the missing
  markup. Caught and fixed before shipping, not left as a known issue.
- **Bug found and fixed in `Room.killPlayer`**: a death that cascades from Suishi (Tianfeng: an
  ally of the just-dead player loses 1 hp and can die from it too) re-ran `checkWinCondition` and
  could overwrite an already-correct winner with the wrong one (a `null`-credited cascade death
  after the lord already died hits `checkWinCondition`'s "no credited killer" branch, changing
  `{winners:[Rebel]}` to `{winners:[Rebel,Renegade]}`) -- a real gameplay bug, not just test
  flakiness, since a live match could show the wrong winner banner. Found via
  `testLordAndLoyalistWin` and `testRebelKillsLord` (previously the only 2 tests left unseeded
  from Milestone 1, before generals with cross-player death hooks existed) flaking under
  `Math.random()`. Fixed by only evaluating/assigning `gameOver` while it's still `null`; both
  tests now seeded like the rest of the suite, and a new
  `testCascadingDeathDoesNotOverwriteGameOver` deterministically reproduces the exact cascade
  (Suishi force-assigned onto a 1-hp loyalist ally of the lord) and proves it no longer overwrites
  the correct result -- confirmed to fail against the pre-fix code, then pass after.
- **Verification:**
  1. `npx tsc --noEmit` clean; `npm run sim` 22/22 passing (8 repeated runs, all deterministic).
  2. Live `ws` client: create → a 2nd client sees it in `listRooms` → joins → claims a seat (3rd
     client sees `seatsClaimed` update) → leaves (seat released, room stays alive for the
     creator) → creator also leaves → room no longer listed. Full lifecycle confirmed end to end.
  3. Real headless-browser run: lobby renders with the create-room control; creating a room shows
     the real game table with every player's Vietnamese name (`Triệu Vân`, `Chân Cơ`, `Mã Siêu`,
     ...); clicking "Rời phòng" returns to an empty lobby list. Screenshots captured at each step.
- 22 tests total, all passing.

**Addendum -- waiting room (room no longer auto-plays before anyone is ready).** Originally a
created room started its `playTurn()` loop immediately (inherited unchanged from Milestone 3's
single-global-room design), so bots were already mid-game before any human could claim a seat.
Fixed: a room now sits idle (`GameRoom.started = false`, no `loopTimer` scheduled) as a pure
seat-picker until its creator (`GameRoom.creatorWs`) sends `startGame`; only then does
`scheduleLoop` actually start, and any seat still unclaimed at that point stays bot-controlled as
before. If the creator leaves before starting, another remaining watcher is promoted to creator
so the room never gets stuck with no one able to start it. `"new"` (reset) also drops the room
back into the waiting state (stops the loop, `started = false`) instead of auto-resuming, so
seats can be rearranged before the next game begins. The state snapshot gained `started` and a
per-recipient `isCreator` flag (computed per-socket in `broadcast`/`joinRoom`, since the shared
snapshot body can't vary by recipient on its own); the client shows a "Bắt đầu trận đấu" button
only to the creator while `!started`, and everyone else sees "Đang chờ chủ phòng bắt đầu...".
- **Verification:** live `ws` client confirmed `turnNumber` stays `0` for 2s of pure waiting (no
  bot activity at all pre-start), a non-creator's `startGame` is rejected with an error and
  `started` stays `false`, and the creator's `startGame` flips `started` true with turns
  immediately advancing. Headless-browser screenshots confirm the waiting-room banner + gold
  start button before clicking, and live turn/log activity immediately after.

## Milestone 5 — DONE (full free-hand Play phase for human seats)

Every prior human-controlled seat only ever answered REACTIVE prompts (yes/no on an
auto-selected card, or WHO to target) -- the engine itself always decided WHICH card to try, in
a fixed order (Ex Nihilo -> Dismantlement -> Snatch -> Duel -> Savage Assault -> Archery Attack
-> God Salvation -> Amazing Grace -> Slash), and a human never saw their own actual hand, only
`handcardNum`. This milestone hands the ENTIRE Play phase to the human: real hand-card images,
click any legal card in any order, until they end the phase themselves.

- `src/combat.ts` -- `allSlashLikeCards`/`allDismantlementLikeCards`/`allDuelLikeCards` added
  alongside the existing `findXLikeCard` singular finders: return EVERY real-or-viewAs match
  instead of just the first, since a freeform Play phase must offer every held copy as its own
  choice (real Sanguosha has no "once per kind per turn" cap -- only Slash has an explicit
  limit -- so playing 2 held Ex Nihilo in one turn is legal and now possible, unlike the bot
  path's `tryPlayOnce` which only ever tries each kind once).
- `src/controller.ts` -- new `FreeAction` union (`equip`/`playCard`/`selfAction`/`activeAction`)
  and `Controller.chooseFreeAction?(player, legalActions)`, optional and left undefined by
  `makeBotController` -- bots keep using the original fixed-order pass, byte-for-byte unchanged
  (confirmed: `testGeneralSkillsAppearInPlay`'s 42/42 markers still all fire the same way).
- `src/room.ts` -- `runPlayPhase` now branches on whether `controller.chooseFreeAction` is
  defined. If so, `runFreeformPlayPhase` takes over: `computeLegalActions` builds the full legal
  list fresh each iteration (every Weapon/Horse card, every playable trick/Slash card gated on
  having a legal target, every not-yet-used-this-turn self/active-action skill), asks
  `chooseFreeAction`, resolves whichever one comes back via `resolveFreeAction`, and loops until
  the player declines (ends the phase) or nothing is legal any more. `resolveFreeAction` reuses
  the EXACT SAME `tryPlayOnce`/`tryPlayTargeted`/`tryPlaySlash`/`equip` helpers the fixed
  automatic pass uses (now accepting an optional `explicitCard` to skip the auto-find + the
  now-redundant `wantsToPlayTrick` yes/no ask) -- so Weimu-immunity, hand-emptied hooks,
  onTrickPlayed hooks, and Huoshou/Juxiang's Savage-Assault-card claim all behave identically
  either way, single source of truth.
- `src/server.ts` -- `makeHumanController` gained `chooseFreeAction`, sending a new
  `{type:"chooseFreeAction", actorId, legalActions}` message (each entry tagged with an
  `actionId` index; selfAction/activeAction entries also carry `skillDisplayName`/
  `skillDescription`, same enrichment `confirmSelfAction` already used). The snapshot broadcast
  gained a per-recipient `myHand` (the claiming socket's own actual `Card[]`, computed fresh per
  `ws` in `broadcast`/`joinRoom` alongside the existing per-recipient `isCreator` -- every other
  client still only ever sees `handcardNum`, unchanged fog-of-war for opponents' hands).
- `public/index.html` -- new hand panel: real card images (`image/card/<kind>.png` for
  basics/tricks, `image/equips/<name>.png` for weapons/horses) with a suit-icon + point-number
  overlay, rendered from `state.myHand`. While a `chooseFreeAction` prompt is pending, legal
  cards light up and become clickable (`onclick` sends the matching `actionId`); non-card
  actions (selfAction/activeAction skills) render as buttons in a bar below the hand alongside
  "Kết thúc lượt" (end phase, sends `actionId: null`).
- **Bug found and fixed while verifying live**: the free-action bar could linger showing a
  stale "Kết thúc lượt" prompt after the claiming player's own seat died or the game ended
  (the server's per-ask timeout has no "prompt cancelled" push to the client, matching the same
  pre-existing gap every other reactive prompt type already has). Fixed by clearing
  `pendingFreeAction` in `render()` whenever `gameOver` is true or the claimed seat is no longer
  alive.
- **Verification:**
  1. `npx tsc --noEmit` clean; `npm run sim` 23/23 passing, including a new deterministic
     `testFreeformPlayLetsHumanChooseCardsAndPlayDuplicates` (confirmed to exercise the new
     freeform loop specifically: a scripted controller equips a chosen weapon by id and plays
     BOTH of 2 held Ex Nihilo copies in the same turn -- something the bot-path fixed pass
     structurally cannot do).
  2. Live `ws` client: claimed a seat, confirmed `myHand` arrives as real `Card[]` on join,
     received a real `chooseFreeAction` prompt with an accurate legal-action list matching the
     actual hand, and answering `actionId: null` correctly ended the phase and let the turn
     advance.
  3. Real headless-browser run: hand renders as real card images with suit/point overlays,
     playable cards highlight and are clickable, clicking one visibly changes the hand (a
     Weapon left the hand once equipped) and advances the game log -- confirmed across many
     turns end to end, including the claimed seat's own general dying mid-game (normal combat)
     and the whole game reaching a clean win-condition conclusion with no errors or stalls.
- 23 tests total, all passing.

**Addendum -- 3 real bugs found from live user feedback after the initial hand-UI ship, all
fixed and verified:**

1. **Target picker never actually became clickable.** `renderPlayer()`'s `.candidate`
   class/`onclick` was only ever applied inside `render(state)`, which runs on a `state`
   broadcast -- but `chooseSlashTarget`/`chooseTrickTarget` prompts arrive as their OWN message
   with no accompanying state broadcast, so the player-card DOM stayed exactly as it was
   rendered before the prompt existed (no highlighting, no click handler). Fixed by extracting a
   `renderPlayers()` helper and calling it from `showTargetPicker()` (and again from
   `answerPrompt()` to clear the highlighting once answered), not just from `render()`.
2. **AOE/untargeted cards (Nam Man Nhập Xâm, Vạn Tiễn Tề Phát, ...) looked unplayable.**
   `server.ts`'s `broadcast()` -- which is what sends the client's `myHand` -- only fires once
   per fully COMPLETED turn; but a `chooseFreeAction` ask can fire mid-turn, after that turn's
   own Draw phase already changed the actor's real hand. The client's hand panel was matching
   `legalActions` (fresh, live cardIds) against `lastState.myHand` (stale, pre-Draw-phase-of-
   this-turn), so freshly-drawn cards never appeared as any DOM element at all. Fixed by having
   `chooseFreeAction`'s payload carry the actor's live `hand` directly (the server already has
   the exact `GamePlayer` object in scope right there), and having the client resync
   `lastState.myHand` from it before rendering -- self-consistent by construction, no more
   reliance on the last full-turn broadcast staying fresh.
3. **Seat claiming allowed mid-match** (explicit user request): `claim` now checks
   `gr.started` server-side and rejects with an error once the match is running; the client's
   claim button is gated on `!state.started` so it simply doesn't render for unclaimed seats
   once play has begun (matches the existing "waiting room = seat picker" design).

**Verification:**
- New deterministic test `testFreeformPlayAOECardIsOfferedAndResolves`: seeds the lord's hand
  with a Savage Assault card and empty hands for everyone else, scripts a `chooseFreeAction`
  controller to play it, and asserts it appears in `legalActions`, resolves with NO target
  prompt at all, and deals exactly 1 damage to every other (non-immune) player -- 5 repeated
  runs all pass identically.
- Live WS test: confirmed `claim` now gets rejected with the Vietnamese error message once
  `startGame` has run; confirmed a real `chooseSlashTarget` arrives with correct `candidateIds`
  and resolves correctly when answered; confirmed every `chooseFreeAction.legalActions` cardId
  matched a card actually present in that same message's `hand` field across dozens of turns
  (would have hard-failed the script otherwise).
- Live headless-browser run (real Puppeteer clicks, not simulated DOM events -- this is what
  actually exercises the CSS `pointer-events` chain): played hand cards until a real
  `chooseSlashTarget` prompt appeared, then `tab.click('.player.candidate')` on the real
  highlighted player card -- click succeeded, prompt closed, turn advanced. Screenshot confirmed
  "Nam Man Nhập Xâm" (Savage Assault) rendering with the gold "playable" border in the hand
  panel. Confirmed 0 enabled claim buttons visible anywhere on the table once the match started.
- `npx tsc --noEmit` clean; `npm run sim` 24/24 passing (5 repeated runs, fully deterministic).

## Milestone 6 — DONE (turn-based general selection + own-role visibility)

Generals were previously auto-assigned with zero interaction (one uniform-random pick per
player, silently, at Room construction). This milestone replaces that with a real selection
phase: after `startGame`, each player is dealt 3 not-yet-taken candidate generals and picks one,
turn by turn, starting with the lord and proceeding around the table in seat order -- matching
real Sanguosha's no-duplicate-generals rule and turn-based selection convention. Every player
also now sees their own role the instant the match starts (previously even your own identity was
hidden from you until `roleShown`, same as everyone else's).

- `src/room.ts` -- general assignment + initial hand-dealing moved OUT of the constructor and
  into a new `pickGenerals(onStep?)`: iterates players starting at the already-tracked lord
  index, deals 3 unique not-yet-taken candidates (`candidateGenerals`, tracked via a
  `takenGenerals` set so no two players in one game ever get the same general), asks each
  player's `Controller.chooseGeneral`, assigns kingdom/skills/maxHp/hp, and only deals initial
  hands (`hand.length === maxHp`) once every player has a general. `pickTurnPlayerId` is exposed
  publicly so server.ts can broadcast "whose turn" mid-selection. `playTurn()` gained a guard
  throwing if called before every player has a general -- fails loudly instead of silently
  running with wrong (default) maxHp/empty skills/no hand if a caller forgets to await picking.
- `src/controller.ts` -- new required `chooseGeneral(candidates): Promise<GeneralDef>` on the
  `Controller` interface (unlike `chooseFreeAction`, every controller needs this one, bot and
  human alike, since every player must end up with a general). `makeBotController` picks
  uniformly at random among its 3 candidates via the shared seeded rng.
- `src/server.ts` -- `startGame` now sets `started`, broadcasts immediately (client enters the
  picking screen), then `await`s `room.pickGenerals(() => broadcast(gr))` in a background async
  IIFE (broadcasting before/after every single pick, so watchers see live progress) before
  finally calling `scheduleLoop`. `makeHumanController` gained `chooseGeneral`, sending a new
  `pickGeneral` message (candidates serialized with displayName/kingdom/maxHp/skill text, same
  enrichment pattern as `chooseFreeAction`) with a longer 30s timeout (a deliberate one-time
  pick with skill text to read, not a reactive combat prompt) and an auto-pick-first fallback so
  the game always proceeds even if a claimed seat goes silent. `snapshot()` gained
  `pickingGenerals`/`pickTurnPlayerId`. New `personalize()` (used by both `broadcast()` and
  `joinRoom()`, replacing their old inline per-socket spread) reveals a claiming socket's OWN
  role once `started`, regardless of `roleShown` -- every player always knows their own identity
  in real Sanguosha; only OTHER players stay fogged per the existing `roleShown` rule (the lord's
  role was already public to everyone from `assignRoles`, unaffected).
- `public/index.html` -- new pick-a-general screen: 3 face-down "Tướng ẩn" cards
  (`image/generals/big/anjiang.png`, the original game's own hidden-general art) with a "Lật
  bài" (flip) button each -- clicking reveals full portrait/kingdom/HP/skill text plus a "Chọn
  tướng này" button, a deliberate two-step manual flow (not auto-revealed) per this milestone's
  ask. While it's not your turn, a "Đang chờ X chọn tướng…" placeholder shows (candidates are
  only ever sent to the asked player's own socket, matching hand fog-of-war). The table/hand
  panel are hidden and swapped for this screen for the duration; `renderHero`'s own-role badge
  (already existing UI, just now actually populated) shows the newly-revealed own role right
  next to your general once the real game view returns.
- **Bug found and fixed while verifying live**: `#pickGeneralPanel`'s toggle used
  `element.style.display = picking ? "" : "none"` -- but that ID's own CSS rule sets
  `display: none` as its base style, so clearing the inline style with `""` just fell back to
  that same `none` (a CSS specificity gap, not a JS logic bug): the 3 candidate cards rendered
  correctly into the DOM but stayed invisible. Fixed by using an explicit `"block"` instead of
  `""`.
- **Verification**:
  1. Live multi-socket WS test (5 claimed human seats): pick order exactly matched
     `lord -> next seat -> ... -> lord's own predecessor` (`P3 -> P4 -> P5 -> P1 -> P2` for a
     lord seated at P3); every ask offered exactly 3 candidates; every player ended with a
     unique general (no duplicates); every player saw their OWN role immediately once started
     (`P1: renegade, P2: rebel, P3: lord, P4: loyalist, P5: rebel`) while P2's role specifically
     stayed `null` as seen from P1's AND P3's own broadcasts (fog of war intact for others) yet
     showed `rebel` correctly on P2's own broadcast.
  2. A second live test confirmed a real picked general (`Hạ Hầu Đôn`) matches the final
     assignment exactly, `myHand.length === maxHp` after dealing, and own role (`lord`) visible
     immediately.
  3. A pure-bot live test (no claimed seats) confirmed the real turn loop resumes correctly
     after picking -- `turnNumber` reached 9 with real combat log lines within 5s.
  4. Live headless-browser run: claimed a seat, watched other (bot) players' picks stream into
     the log in real time, reached the real pick-general screen for the claimed seat itself
     (3 face-down cards + "Lật bài"), flipped one (revealed portrait/kingdom/HP/skill text +
     "Chọn tướng này" appeared), picked it, and confirmed the real game view returned cleanly:
     own hero panel showing the picked general with role badge (`Trung Thần`) next to it, hand
     dealt to exactly `maxHp` real cards, the lord's `CHỦ CÔNG` tag publicly visible on their
     seat, and every other seat's role tag correctly absent (still fogged).
  5. `npx tsc --noEmit` clean; `npm run sim` 24/24 passing.


## Milestone 7 — Audit: defense/counter-play mechanics (Sát/Thiểm, Nullification, nội tại)

User asked to verify the "responding to an attack" mechanism -- Slash/Jink, Nullification (Vô
Giải Khả Kích), and passive/innate ("nội tại") skills. Audit result below, plus one real bug
found and fixed, one real regression found and fixed, and one confirmed gap.

**✅ Correct and already covered:**
- Slash → Jink (`resolveSlash` in `src/combat.ts`): asks the SPECIFIC defending player
  (`ctx.askDodge`), not automatic; respects every dodge-related nội tại skill --
  Longdan/Qingguo (view another card as Jink), Kongcheng (immune to Slash/Duel targeting),
  Tieqi/Liegong (block the dodge decision outright), Xiangle/Liuli (nullify/redirect before the
  Jink check), Wushuang (needs 2 Jinks, not 1), Mengjin/Leiji (fire after a successful dodge).
- Duel (Quyết Đấu, `resolveDuel`): real back-and-forth "counter" exchange -- alternates asking
  each side to play a Slash, first to fail/decline takes the damage; also Wushuang-aware.
- Damage-side nội tại: Mingshi/Beige (`reduceDamage`, can floor damage to 0 and cancel the hit
  entirely), Weimu/Biyue (immune to black-suited tricks).

**🐛 Bug found and fixed**: Savage Assault (Nam Man Nhập Xâm) and Archery Attack (Vạn Tiễn Tề
Phát) were auto-discarding a held Slash/Jink to avoid damage with NO ask at all -- denying the
player the real Sanguosha choice to keep the card and take 1 damage instead (the same choice
`resolveSlash`/`resolveDuel` already correctly offer). Fixed:
- `src/combat.ts` -- exported `findJinkLikeCard` (was private); added
  `askSavageAssaultSlash`/`askArcheryAttackJink` to `EngineContext`.
- `src/controller.ts` -- new `wantsToDiscardForSavageAssault`/`wantsToDiscardForArcheryAttack`
  on `Controller`; bots default to `true` (matches the existing greedy card-preservation policy).
- `src/trick.ts` -- `resolveSavageAssault`/`resolveArcheryAttack` now find the held card viewAs-
  aware (`findSlashLikeCard`/`findJinkLikeCard`, so Wusheng/Longdan-style skills work here too)
  and only discard it if the ask returns true; declining still deals the 1 damage.
- `src/server.ts` -- `makeHumanController` gained the 2 new asks (`confirmSavageAssaultSlash`/
  `confirmArcheryAttackJink` messages); `public/index.html` renders them via the existing
  `showConfirm` yes/no overlay with Vietnamese prompt text.
- New deterministic test `testSavageAssaultAndArcheryAttackAreAChoice`: proves declining leaves
  the card unspent AND deals damage, accepting spends it AND avoids damage, for both cards.

**🐛 Regression found and fixed** (unrelated to the audit itself, caught while browser-verifying
it): `<div id="promptOverlay"><div id="prompt"></div></div>` -- the root element EVERY
confirm/target-picker prompt depends on -- had been silently deleted from `public/index.html` by
a stale-line-number edit earlier in Milestone 6's session (a `PUT` using pre-shift line numbers
overwrote that exact line instead of the two misplaced `const` declarations it was meant to
move). `document.getElementById("promptOverlay")` had been returning `null` ever since, meaning
every prompt type silently threw the moment it tried to activate -- undetected because no
browser test in that window happened to trigger a confirm/target-picker dialog. Restored the
markup; re-verified via ~350 real-click browser iterations across 4 live games, observing 10
distinct real prompts resolve correctly end to end (Slash/Duel/Snatch/Dismantlement target
pickers, dying/Peach, self-action skill confirm, dodge confirm, and both new Savage
Assault/Archery Attack discard-choice confirms).

**❌ Confirmed gap: Nullification (Vô Giải Khả Kích) is NOT implemented.** Not in the `CardKind`
enum, not in the dealt deck, no reactive counter-play window of any kind exists for ANY trick
card (Duel, Dismantlement, Snatch, Savage Assault, Archery Attack, God Salvation, Amazing Grace,
Ex Nihilo all resolve with zero chance for another player to cancel them). This has been an
explicitly documented gap since Milestone 1.5 (see `src/card.ts`'s header and `src/trick.ts`'s
module comment) -- it needs a genuinely new subsystem: a delayed-trick/judge-area-style
"reactive stack" that, after a trick card's target(s) are determined but before it resolves,
asks every other player in turn order whether they want to play Nullification against it, then
recursively asks again if one is played (a nullification can itself be nullified), until
everyone passes. This is a substantially larger feature than the fixes above (new card kind,
new resolution-order interception point touching all 8 trick resolvers, new ask/UI flow) and has
not been built -- flagging for an explicit scope decision rather than building it unprompted.
- `npx tsc --noEmit` clean; `npm run sim` 25/25 passing.

## Milestone 8 — DONE (end-of-turn Discard: choose exactly which cards, not arbitrary)

`discardDownToLimit` (the end-of-turn "hand exceeds hp" cleanup) used to always splice off the
first N cards in hand order -- no ask, no choice. This milestone hands that choice to the
player, same "real decision" pattern as Milestone 5's free-hand Play phase.

- `src/controller.ts` -- new required `chooseDiscards(player, count): Promise<Card[]>` on
  `Controller` (every controller needs it, bot and human alike -- someone must always end up
  choosing). Bot default: first `count` held cards (byte-for-byte the old behavior, so bot-only
  games are unaffected).
- `src/room.ts` -- `discardDownToLimit` now asks `chooseDiscards`, then validates the answer
  (exactly `count` DISTINCT cards, all still actually in hand) before discarding them -- falls
  back to the original first-N behavior if a controller returns something invalid, so a
  misbehaving/timed-out response can never desync the discard count.
- `src/server.ts` -- `makeHumanController` gained the ask (`chooseDiscards` message, carrying
  `count` + the live `hand`); fallback on timeout/disconnect matches the bot default (first
  `count` held cards) so the game never stalls on a silent player.
- `public/index.html` -- the hand panel gains a third mode (alongside normal play and free-hand
  Play-phase play): click cards to toggle red "selected for discard" highlighting up to exactly
  `count`, then a "Xác nhận bỏ bài" button (disabled until exactly `count` are selected) confirms.
- New deterministic test `testDiscardChoiceLetsHumanPickWhichCards`: a scripted controller
  deliberately picks the LAST `count` cards (the opposite end from the bot's first-N default)
  and confirms exactly those left the hand -- proves the choice is actually honored, not just
  type-checked.
- **Verification**: live WS test confirmed the server asks with the correct `count`/`hand` and
  discards EXACTLY the submitted card ids (checked by diffing the hand before/after -- a 7-card
  hand asked to shed 4 ended up with precisely the 3 cards NOT selected). Live browser run:
  reached the real discard-selection UI ("Bài trên tay vượt quá số máu — chọn 1 lá để bỏ"),
  confirmed the confirm button starts disabled, enables only once exactly the required count is
  selected (with live red highlighting), and clicking confirm left exactly the un-selected card
  in hand ("Thiểm" kept after discarding "Tửu"). `npx tsc --noEmit` clean; `npm run sim` 26/26
  passing (5 repeated runs, fully deterministic).

## Milestone 9 — DONE (equip shows/applies immediately, not delayed to turn end)

`broadcast(gr)` (the JSON "state" snapshot every client renders from) previously only fired once
per fully COMPLETED turn (`scheduleLoop`). Server-side the equip buff was already 100% live the
instant `player.weapon`/`defenseHorse`/`offenseHorse` was set (`attackRange`/`effectiveDistance`
read them directly, no caching) -- but no client, including spectators and the equipping player's
own table card, ever SAW it until the whole turn finished. Fixed by broadcasting immediately.

- `src/room.ts` -- new `Room.setLiveUpdateCallback(cb)` registers a callback fired at the end of
  `equip()` (the single method both the bot's fixed pass and the human freeform loop funnel
  through), right after the buff is already applied and logged.
- `src/server.ts` -- both places a room's `Room` gets constructed (`createRoom`, and the `"new"`
  reset handler) now call `gr.room.setLiveUpdateCallback(() => broadcast(gr))`, so an equip
  immediately broadcasts the fresh state to every client watching -- not just the equipping
  player's own `chooseFreeAction` hand payload (which already only kept THEIR OWN hand fresh,
  never the table-wide equip icons everyone else sees).
- New deterministic test `testEquipTriggersLiveUpdateCallback`: registers the callback directly
  and confirms it fires exactly once per equip, with `player.weapon` already reflecting the new
  item at the exact moment the callback runs (proves synchronous, not merely "eventually").
- **Verification**: live 2-socket WS test (P1 equipping, a pure spectator watching) confirmed the
  spectator's state broadcast whose log tail is exactly `"P1 equips Fan"` ALREADY carries
  `weapon: "Fan"` in that same message -- not a later one. Live browser run (2 tabs) confirmed
  the table view's equip icons render correctly. `npx tsc --noEmit` clean; `npm run sim` 27/27
  passing.
- **Minor cosmetic issue found and fixed while verifying**: `public/index.html`'s
  `#pickGeneralCards` container kept its stale (now `display:none`-ancestor-hidden) `.generalCard`
  DOM after the picking phase ended instead of clearing `innerHTML` -- invisible to players (the
  panel itself is hidden), only observable by scripts querying the DOM directly. Fixed by clearing
  it alongside `pendingGeneralPick` whenever `render()` sees picking has ended.

## Milestone 9.1 — DONE (broadened Milestone 9's fix: every visible action, not just equip)

User report: playing a card ON ANOTHER PLAYER (e.g. Slash) still didn't show up immediately for
watchers -- Milestone 9 only wired `onLiveUpdate` into `equip()`. Every other state-mutating
action (Slash damage/death, the 8 trick cards, proactive self/active-action skills, and the
end-of-turn Discard) still only became visible once the whole turn finished.

- `src/room.ts` -- added `this.onLiveUpdate?.()` calls after every other place game state
  visibly changes: the end of `tryPlayOnce`/`tryPlayTargeted` (both exit paths, including the
  Weimu-fizzle early return) and `tryPlaySlash` -- the three shared helpers BOTH the bot's fixed
  pass and the human freeform loop (`resolveFreeAction`) funnel every trick card and Slash
  through, so one call site each covers both paths for Slash/Dismantlement/Snatch/Duel/
  ExNihilo/SavageAssault/ArcheryAttack/GodSalvation/AmazingGrace. Also added after every
  self/active-action skill resolution (duplicated in the bot's `runPlayPhase` loop and
  `resolveFreeAction`'s branches, since those aren't behind a shared helper) and after
  `discardDownToLimit` actually discards.
- New deterministic test `testSlashTriggersLiveUpdateCallback` (companion to the equip one):
  confirms the callback fires exactly once for a Slash played on another player, with the
  target's `hp` already reduced at the exact moment the callback runs.
- **Verification**: live 2-socket WS test (a pure spectator watching an all-bot game) found the
  first broadcast whose log tail contained `"P5 slashes P4"` / `"P4 takes 1 damage (hp 2/3)"` --
  that SAME broadcast's `players` array already showed P4 at `hp: 2`, not a later one. Live
  headless-browser run (real Puppeteer clicks, no simulated DOM events -- this is what a real
  user sees) drove a full match to a Slash exchange and confirmed the table/log render correctly
  as combat happens in real time. `npx tsc --noEmit` clean; `npm run sim` 28/28 passing.

## Milestone 10 — DONE (equip icons show their EFFECT, not just their name)

User report: equip icons were only ~16px with a hover-only `title` tooltip carrying just the
internal card name -- no indication anywhere of what a weapon/horse actually DOES (attack range,
distance delta) without reading the log or knowing the card by heart.

- `src/server.ts` -- the state snapshot now also sends `weaponRange` and
  `defenseHorseDelta`/`offenseHorseDelta` alongside the existing name fields, straight from the
  Card's own `weaponRange`/`horseDelta` (the same values `player.ts`'s `attackRange` getter and
  `combat.ts`'s `effectiveDistance` already use server-side) -- not hand-copied constants.
- `public/index.html` -- new shared `equipIcons(p)` helper (used by both the table's per-seat
  cards and the player's own big hero panel, which previously showed NO equip row at all): each
  equip renders as a bigger (28px, up from 16px) icon with an always-visible colored number badge
  overlaid on it -- gold for a weapon's Sát range, blue `+1` for a defense horse (others need +1
  distance to reach you), orange `-1` for an offense horse (your distance to others -1). The
  tooltip now also spells out the effect in Vietnamese, not just the card name.
- **Verification**: live headless-browser run (real clicks) through general selection into real
  combat found `Tào Tháo` equipping Axe/JueYing/SixSwords -- table screenshot confirms the gold
  `2`/blue `+1` badges render legibly at both the table-seat size and the larger own-hero-panel
  size. `npx tsc --noEmit` clean; `npm run sim` 28/28 passing.

## Milestone 11 — DONE (general card + skill text was too small to read)

User report: the pick-a-general candidate cards and every skill name/description (table seats,
pick screen) were cramped and hard to read.

- `public/index.html` -- pure CSS pass, no markup/protocol changes:
  - `.generalCard` (pick-a-general candidates): 168px -> 232px wide, portrait 210px -> 240px
    tall, name 17px -> 20px, meta 10.5px -> 11.5px, body padding 12px -> 15px.
  - Shared `.skillName`/`.skillDesc` (used by BOTH the pick-a-general cards and every table
    seat's skill list): 10.5px -> 12px/11.5px, line-height 1.4 -> 1.45, more breathing margin --
    one change point fixes both screens since they already shared the class.
  - `#table`'s side columns (P4/P8 in an 8p game) widened 190px -> 212px so the now-larger skill
    text has room to wrap without feeling more cramped than the top/bottom seats; `#table`/
    `#myHero`/`#myHandWrap`/`#logWrap` max-width bumped 1180px -> 1280px to match so the whole
    page still lines up as one consistent column. Avatar rings and the player id/general name
    text bumped slightly (54px->58px, 13px->14px, 11px->12px) to stay proportional.
- **Verification**: live headless-browser screenshots of both screens -- the pick-a-general
  screen (3 candidates, multi-skill Điền Phong card) and the in-game table (8 seats, real skill
  text like "Sau khi bị thương, có thể bỏ 1 lá để phán...") -- confirm every skill name and
  description now renders clearly legible, not just technically present. `npx tsc --noEmit`
  clean; `npm run sim` 28/28 passing.

## Milestone 12 — DONE (lord's identity leaked in the lobby, before seating/start)

User report: "chủ công" was tagged from the moment the room was created, visible to everyone in
the waiting room -- before any seat was even claimed, let alone the match started -- while every
other role correctly stayed hidden (`?`) until its own proper reveal moment.

Root cause: `assignRoles()` runs in the `Room` constructor, which fires at `createRoom()` --
i.e. in the LOBBY, the moment someone creates a room, well before "Bắt đầu trận đấu". It was
setting `roleShown = true` for the lord right there, so the state snapshot leaked it immediately.

- `src/gamerule.ts` -- `assignRoles()` no longer special-cases the lord's `roleShown`; every
  player starts hidden (`GamePlayer`'s own default), matching every other role's starting state.
- `src/room.ts` -- `Room.pickGenerals()` (the actual "the match has begun" moment -- called right
  after `server.ts`'s `startGame` handler flips `gr.started = true`) now reveals the lord's role
  as its first action, before dealing the first candidate generals. Real Sanguosha rule (the
  lord's identity is public once the match starts) preserved -- just no longer leaked early.
- `testRoleDistribution` updated: asserts NOBODY is shown right after `new Room(...)` (construction
  time), then that only the lord becomes shown after `pickGenerals()` runs.
- **Verification**: live WS test -- the lobby snapshot (right after `createRoom`) shows
  `role: null` for all 8 seats; even the broadcast immediately after `startGame` (`started: true`,
  before `pickGenerals`'s first step) still shows every role hidden; the lord becomes visible on
  the very next broadcast once picking actually begins. Live browser screenshot of the waiting
  room confirms every seat shows `?`, no "CHỦ CÔNG" tag anywhere before Start. `npx tsc --noEmit`
  clean; `npm run sim` 28/28 passing.

## Milestone 13 — DONE (Amazing Grace was "everyone draws 1", not the real reveal-and-draft)

User report: Amazing Grace (Ngu Coc Phong Dang) should reveal N face-up cards (N = alive player
count), then each player takes turns -- starting from whoever played the card -- picking exactly
ONE of the still-available cards, not everyone silently drawing a random one simultaneously. This
was a known, explicitly documented simplification since Milestone 1.5 (trick.ts's header).

- `src/combat.ts` -- new required `EngineContext.askPickCard(player, candidates): Promise<Card>`.
- `src/controller.ts` -- new required `Controller.choosePickCard`; bot default picks
  `candidates[0]` (matches every other "no preference" bot default, e.g. `chooseDiscards`).
- `src/trick.ts` -- `resolveAmazingGrace` rewritten: draws up to `n` cards face-up into a pool
  (fewer only if the draw pile runs out mid-reveal), then loops player-by-player starting at the
  source and wrapping around the table, asking each to pick one and removing it from the pool.
  Falls back to `pool[0]` if a controller returns something not actually in the pool (same
  defensive pattern as `chooseDiscards`'s count/membership check).
- `src/room.ts` -- wired `askPickCard` into `makeContext()`, delegating to the controller.
- `src/server.ts` -- new `choosePickCard` human ask, sending the full revealed `cards` pool;
  timeout/disconnect falls back to the first card (matches the bot default).
- `public/index.html` -- new `choosePickCard` prompt: a wider overlay (`#prompt:has(#pickCardOptions)`)
  showing every still-available card as a clickable face-up option (image + label), no "Bỏ qua"
  (real Sanguosha requires the player whose turn it is to take exactly one, not decline).
- New deterministic test `testAmazingGraceIsATurnOrderDraft`: every player's `choosePickCard`
  deliberately picks the LAST pool card (not the bot's own "first" default) and records order/
  pool size/chosen id; asserts exactly 8 picks, starting at the card's user, wrapping the table
  in seat order, the pool shrinking by exactly 1 each turn, and all 8 chosen cards distinct.
- **Verification**: the deterministic test above proves the server-side draft logic. Live
  browser check (real clicks): injected a `choosePickCard` message directly into the running
  client, confirmed the prompt renders every revealed card as a clickable face-up option with
  the correct title/card count, and that clicking one sends exactly
  `{ type: "response", requestId, cardId }` and closes the prompt -- matching the exact shape
  `server.ts`'s `askClient` interpret function expects. (A full real-game WS run wasn't a
  reliable verification path here -- Amazing Grace is 2 of 85 cards and needs both a lucky draw
  and the bot's `wantsToPlayTrick` to fire in the same real-time session; the deterministic test
  plus the direct client-side proof together already cover both ends of the wire.) `npx tsc
  --noEmit` clean; `npm run sim` 29/29 passing.

## Milestone 14 — DONE (target-picker overlay made legal targets hard to see)

User report (with screenshot): the dim modal overlay behind a target-picker prompt (Slash/Duel/
etc.) made the whole table equally dark, so it was hard to tell which players were actually
legal targets -- the `.candidate` styling only added a border, with a glow shown on `:hover`
only, easy to miss under a 70%-black overlay.

- `public/index.html` (CSS only, no protocol changes):
  - `.player.candidate` now gets an ALWAYS-ON pulsing red glow (`@keyframes candidatePulse`),
    not just on hover -- unmistakable even before the mouse moves.
  - New `.player.noncandidate` (dimmed + grayscaled) applied to every player who is NOT a legal
    target while a prompt is pending, EXCEPT the acting player themself (stays full brightness
    for context) -- a real spotlight effect instead of "everyone equally dark."
  - `#promptOverlay.picking` (used only by `showTargetPicker`, i.e. Slash/trick target prompts)
    dims the backdrop less (0.4 vs the confirm-dialogs' 0.7) so the above highlighting reads
    clearly through it; confirm/equip/dodge/peach-style prompts (no board relevance) keep the
    original heavier dim.
- **Verification**: live browser check -- rendered a real 8-seat table with a `chooseTrickTarget`
  (Duel) prompt naming 3 of 8 as candidates. Screenshot confirms the 3 candidates glow with a
  vivid red highlight, the other 4 fade into the background, and the acting player's own card
  stays fully visible. Clicking a highlighted candidate sent exactly
  `{ type: "response", requestId, targetId }` and closed the prompt. `npx tsc --noEmit` clean;
  `npm run sim` 29/29 passing.

## Milestone 15 — DONE (target-picker box still covered/blocked candidate cards)

User report (with screenshot): Milestone 14 made legal targets glow, but the prompt box itself
was still centered on the viewport -- landing directly on top of whichever player card sat
nearest the middle of the table (often a candidate), visually and physically blocking it (the
box is `pointer-events:auto`, so a candidate hidden underneath couldn't be clicked either).

- `public/index.html` (CSS only): `showTargetPicker`'s prompt (Slash/trick target picking) no
  longer centers on the viewport. `#promptOverlay.picking` now docks it as a slim horizontal
  banner (icon + title + sub + Bỏ qua, all in one row) pinned to the BOTTOM of the viewport
  (`align-items: flex-end`) instead of the middle -- confirm/equip/dodge/peach/pick-card prompts
  are unaffected (still centered, since they don't need to coexist with a visible table). Chose
  bottom-docking over top-docking after measuring the real layout: the gap between the header and
  the table's top row is too small (~18px) to fit even a slim banner without still clipping the
  top-row seats; the bottom of the viewport has no such constraint regardless of how much content
  (hero panel, hand, hand-count) sits above the table that turn.
- **Verification**: `npx tsc --noEmit` clean; `npm run sim` 29/29 passing. Confirmed via computed
  geometry (`getBoundingClientRect`) in a live headless-browser render that the repositioned
  banner no longer overlaps any of the 8 player cards, before finalizing the bottom-dock choice.
  A final post-fix screenshot re-check hit a headless-browser tool/daemon outage unrelated to
  this repo (`browser: open` timed out repeatedly even after killing stale `omp.browser.headless`
  Chrome processes) -- the fix itself is a single, well-understood CSS positioning change
  (`align-items`/`padding-bottom` on a `position:fixed` flex container), and the underlying
  candidate-highlight mechanism it wraps (Milestone 14) was already screenshot-verified unchanged.

## Milestone 16 — DONE (click-to-draw pile + own-role privacy toggle)

Two user requests: (1) the Draw phase gave no interaction at all -- cards just silently appeared
in hand every turn; wanted a face-down draw-pile card in the middle of the table you click to
draw, like a physical deck. (2) a toggle to hide your OWN role, so someone sitting/looking near a
shared screen can't read it off just by glancing over.

### Click-to-draw pile
- `src/controller.ts` -- new required `Controller.wantsToDrawNow(player, count): Promise<void>`;
  bot default resolves immediately (no pause, byte-for-byte unchanged bot behavior/turn speed).
- `src/room.ts` -- `runPhase`'s `Phase.Draw` case now `await`s `wantsToDrawNow` BEFORE calling
  `drawCards`, and fires `onLiveUpdate` right after (same "broadcast the moment it actually
  happens" pattern as every other action since Milestone 9.1) so a human's own draw-pile click is
  immediately visible to spectators/other seats too, not just at turn-end.
- `src/server.ts` -- new `confirmDrawCard` human ask sending `{ actorId, count }`; times out to
  auto-draw (matches the bot default) so an idle/disconnected human never stalls the table.
- `public/index.html` -- a clickable face-down draw-pile card (`image/system/card-back.png`)
  overlays the table's center emblem exactly while a `confirmDrawCard` prompt for MY seat is
  pending, with an always-on pulsing gold glow and a "Rút N lá" label; clicking sends the ack.
  Everywhere else (not my Draw phase, or I'm a bot/spectator) it stays hidden and the normal
  emblem/turn indicator shows through.
- New deterministic test `testDrawPhaseAsksBeforeDrawing`: proves `wantsToDrawNow` is asked
  exactly once, with the correct card count, and the hand-size snapshot captured AT ask time
  still matches the pre-draw count (i.e. the ask genuinely precedes `drawCards`, not just
  logged after the fact).
- **Verification**: live 1-socket WS test with a deliberate 800ms delay before responding to the
  first `confirmDrawCard` -- the state broadcasts during that window all show the pre-draw hand
  count (3) unchanged; the instant the delayed response is sent, the very next broadcast jumps to
  the post-draw count (5 = 3+2), proving the server genuinely blocks the real draw on the human's
  answer, not racing ahead regardless of it. `npx tsc --noEmit` clean; `npm run sim` 30/30 passing.

### Own-role privacy toggle
- `public/index.html` only (pure client-side render toggle, no protocol change -- the server
  already only ever reveals a claiming socket's own role to that socket; this just controls
  whether THIS TAB chooses to display what it already received). New header button (👁/🙈,
  preference persisted in `localStorage`) masks the role text/color/icon specifically for
  `p.id === mySeat` in both the table's own seat card and the big hero panel -- every other
  player's role display is completely unaffected by the toggle.
- **Verification**: unit-tested the exact masking expressions (extracted verbatim from the
  shipped file) against both a "self" and an "other player" input -- confirms hiding masks the
  role label, its color-coded CSS class, AND the lord/renegade icon together (no partial leak via
  any one of the three), and that toggling never touches another player's role display. (A full
  click-through browser screenshot hit the same headless-browser tool outage noted in Milestone
  15 -- unrelated to this change; every other verification layer above is unaffected by it.)

## Milestone 17 — DONE (Peach: proactive self-heal + ally rescue)

User report: "lá đào có thể dùng trong lượt để hồi máu cho bản thân" (Peach should be usable
during your own turn to heal yourself), plus real Sanguosha's other Peach behavior this port was
still missing: when a player is dying, every OTHER alive player (not just the dying player
themself) should get a chance to spend their own held Peach to save them, in turn order starting
right after the dying player.

### Proactive self-heal
- `src/trick.ts` -- new `resolvePeachSelfHeal(ctx, player)`: heals 1 hp, logs it.
- `src/room.ts` -- `computeLegalActions` now offers every held Peach as a `playCard` action
  whenever `player.isWounded()`; `resolveFreeAction`'s switch gained a `CardKind.Peach` case
  (spend the card, heal, live-update). This is the ONLY path a claimed human seat needs --
  freeform play already lists/resolves every action generically, no protocol change required.
- `src/controller.ts` -- new `Controller.wantsToUsePeachSelfHeal(player)`, bot default `false`:
  the fixed automatic bot pass declines it (preserves the pre-existing "bots never proactively
  burn Peach/Analeptic outside a real dying emergency" behavior other tests already depend on);
  a small bot-pass loop in `room.ts` wires the hook for parity/testability even though real
  human seats never reach it (they always have `chooseFreeAction`, which skips the fixed pass).
- New deterministic test `testFreeformPlayLetsHumanSelfHealWithPeach`: wounds the lord by 1 via
  `damagePlayer`, seeds exactly 1 Peach in hand, drives a real `playTurn()` through a
  `chooseFreeAction` controller, and confirms the card appeared in `legalActions`, healed exactly
  1 hp, left the hand, and logged.

### Ally rescue
- `src/combat.ts` -- new `EngineContext.askPeachForOther(rescuer, dyingPlayer): Promise<boolean>`;
  `resolveDying` rewritten: after the dying player's own self-rescue (`askPeach`) declines/runs
  out, it now loops every OTHER alive player once, in turn order starting right after the dying
  player and wrapping the table, offering each a chance to spend their own held Peach to save
  them -- stops at the first acceptance, repeats the whole self-then-others cycle if still <=0
  hp afterward, and only gives up (recording the death) once nobody at all can or will help.
- `src/controller.ts` -- new `Controller.wantsToUsePeachForOther(rescuer, dyingPlayer)`. Bot
  default `false` (deliberately, unlike every other self-serving ask's `true` default): whether
  to spend YOUR OWN card to save someone ELSE is a genuinely strategic, role-aware decision this
  simple greedy policy doesn't model, and defaulting it to `true` would have made bots spend
  Peaches on allies unconditionally -- breaking `testCascadingDeathDoesNotOverwriteGameOver`'s
  premise (confirmed live: that regression failed until this default was set to `false`).
- `src/server.ts` -- new `confirmPeachForOther` human ask, sending `{ actorId, dyingPlayerId }`;
  times out to `false` (declining), matching the bot default and the existing "offensive/
  optional-resource action" fallback policy.
- `public/index.html` -- new prompt branch showing the dying ally's general name/portrait art
  ("`<Tên tướng>` đang hấp hối! Dùng Đào để cứu đồng minh?"), reusing the existing generic
  `showConfirm` yes/no prompt component.
- New deterministic test `testAllyRescuePeachSavesADyingPlayer`, driven directly through
  `resolveSlash` (pure): dying player declines self-rescue, the first ally in turn order holds a
  Peach but declines, the second accepts -- proves the exact turn order, that a decline doesn't
  stop the loop, that the accepting rescuer's card (and only theirs) is spent, and the correct
  log line/credited outcome.
- **Verification**: `npx tsc --noEmit` clean; `npm run sim` 32/32 passing (including both new
  tests above). Live browser check: injected a `WebSocket` spy via `page.evaluateOnNewDocument`
  to capture the real page's `onmessage` handler before its own `connect()` ran, fed it a
  synthetic `state` broadcast + `confirmPeachForOther` message, and confirmed the rendered prompt
  showed the correct dying player's name ("Tôn Kiên đang hấp hối!") with the Peach card art, and
  that clicking "Đồng ý" sent back the exact expected `{ type: "response", requestId, value:
  true }` payload.

## Milestone 18 — DONE (single-port deploy: server now also serves the client)

User asked how to deploy this for other people to actually play together. Previously the client
(`public/index.html`) had to be opened as a local `file://` page, hardcoded to `ws://<hostname>:
8787` -- fine for same-machine/LAN testing, but unworkable for a real public deployment (no way
to serve the page itself, and `file://` pages can't be reached by anyone else; also no `wss://`
support, which browsers require once the page is served over `https://`).

- `src/server.ts` -- the `WebSocketServer` now attaches to a plain `node:http` server instead of
  listening on its own bare TCP port; that http server also serves `public/index.html` at `/`
  plus this repo's own `image/`/`font/` asset directories (which `index.html` already referenced
  via `../../image`, `../../font` -- unchanged) at `/image/*` and `/font/*`. Static serving is a
  small hand-rolled whitelist (no new dependency): only those 2 prefixes + `/`/`/index.html` are
  ever read from disk, with an explicit path-traversal guard. Net effect: ONE process, ONE port
  (`PORT` env, default 8787) serves everything -- a deployment only ever needs to expose/forward
  that single port, instead of separately hosting static files and the WebSocket API.
- `public/index.html` -- `connect()` now builds the WebSocket URL from the page's OWN
  `location.protocol`/`location.host` (`wss://` automatically when the page itself is served over
  `https://`, same host, no hardcoded port) instead of a hardcoded `ws://<hostname>:8787`. Falls
  back to `ws://localhost:8787` only when there's no `location.host` at all (i.e. still opened
  directly as a local `file://` page for quick dev iteration without even running the server's
  static half).
- **Verification**: `npx tsc --noEmit` clean; `npm run sim` 32/32 passing. Live check: restarted
  the server and confirmed over real HTTP (not `file://`) that `GET /` serves the page (200,
  `text/html`), `GET /image/card/peach.png` and `GET /font/UTMThuPhap.ttf` serve the real assets
  (200, correct `Content-Type`), an unknown path 404s, and a `../../../etc/passwd`-style
  traversal attempt also 404s (blocked, not served). Loaded `http://localhost:8787/` in a real
  browser tab end-to-end and confirmed the status line reads "Đã kết nối" (connected) -- the
  same-origin `wss`/`ws` auto-detection actually works, not just type-checks.

## Milestone 19 — DONE (Analeptic: Slash damage buff + rescue-card parity with Peach)

User asked what Tửu (Analeptic) does, then to implement it -- it existed only as a dealt card
with zero effect (usable as a generic skill-cost payment or discarded when over the hand limit,
nothing else). Real Sanguosha gives it 2 distinct effects, traced from the upstream engine's
`Analeptic::onEffect`/`Slash::onEffect` (`src/package/standard-basics.cpp`,
`src/server/gamerule.cpp`'s `SlashHit` handling): (1) played proactively during your own Play
phase, it arms a +1 damage bonus for the very next Slash you play that turn; (2) played on a
dying player (self or an ally), it heals 1 hp exactly like Peach -- the two effects are
distinguished purely by WHEN it's played (a dying-rescue ask vs. a normal Play-phase action), not
by any player choice.

### Slash damage buff
- `src/player.ts` -- new `pendingSlashBonusDamage` field, separate from the existing
  `pendingBonusDamage` (Luoyi's more general "next damage of any kind"): Analeptic's real card
  text specifically boosts a Slash, not Duel/AOE/self-inflicted skill damage, so it needed its
  own dedicated, narrowly-scoped consumption point instead of reusing the generic one.
- `src/combat.ts` -- `resolveSlash` now reads and clears `attacker.pendingSlashBonusDamage` the
  instant a Slash begins resolving (before the Jink-dodge check even runs, matching the upstream
  `Slash::onEffect`'s consumption timing exactly) and adds it to the final damage amount. A
  dodged or nullified Slash still wastes an already-armed bonus, same as the real rule.
- `src/trick.ts` -- new `resolveAnalepticBuff(ctx, player)`: increments the pending bonus, logs
  it. No once-per-Play-phase cap is enforced (the real rule limits Analeptic itself to 1 use per
  turn) -- deliberately consistent with this engine's existing "no once-per-kind-per-turn cap,
  only Slash has an explicit limit" simplification already used by every other proactive
  trick-like card in the freeform Play phase (ExNihilo, GodSalvation, etc.).
- `src/controller.ts`/`src/room.ts` -- new `Controller.wantsToUseAnalepticBuff`, bot default
  `false` (same reasoning as Milestone 17's `wantsToUsePeachSelfHeal`: bots never proactively
  burn Peach/Analeptic outside a real dying emergency -- an EXISTING test,
  `testDiscardChoiceLetsHumanPickWhichCards`, explicitly depends on this for Analeptic too).
  Wired into `computeLegalActions`/`resolveFreeAction` (unconditional, like ExNihilo) for the
  real human choice, plus a parity/testability-only bot-pass loop that's a no-op in practice
  since the bot always declines.
- New deterministic test `testFreeformPlayLetsHumanBuffSlashWithAnaleptic`: seeds exactly 1
  Analeptic + 1 Slash, drives a real freeform turn playing both in order at an empty-handed
  (guaranteed-hit) target, confirms 2 damage landed (not 1) and the bonus field is fully
  consumed afterward.

### Rescue-card parity with Peach
- `src/combat.ts` -- the old Peach-only `findPeachLikeCard` renamed `findRescueCard` and
  extended to match real Analeptic cards too (not just Peach/viewAs); new `rescueCardLabel`
  helper so `resolveDying`'s log correctly says "analeptic" or "peach" by the REAL card kind
  used, instead of mislabeling a genuine Analeptic rescue as a "views a card as peach (viewAs
  skill)" substitution (that line is now reserved for actual viewAs skills, e.g. Jijiu).
- New deterministic test `testAnalepticSelfRescuesADyingPlayer`: a dying player holding only an
  Analeptic (no Peach) self-rescues, driven directly through `resolveSlash`; confirms survival,
  the card being spent, and the exact log wording ("uses analeptic to recover", not "peach" and
  not a "views a card as" viewAs-substitution line).
- **Regression fix**: `testCascadingDeathDoesNotOverwriteGameOver`'s seeded loyalist could
  randomly hold an Analeptic and now self-rescue from the Suishi cascade (bots always accept
  self-rescue) -- fixed by explicitly clearing that player's hand in the test setup, since the
  test's actual intent (the win-condition-overwrite bug) doesn't depend on what they're holding.
- **Verification**: `npx tsc --noEmit` clean; `npm run sim` 34/34 passing (including both new
  tests above). Live browser check: same `WebSocket`-spy technique as Milestone 17/18 --
  injected a `chooseFreeAction` message with an Analeptic entry in `legalActions`, confirmed the
  hand rendered it as a clickable "Tửu"-labeled card with working card art
  (`GET /image/card/analeptic.png` 200), and that clicking it sent back the exact expected
  `{ type: "response", requestId, actionId }` payload.

## Deploy

This is a single stateless Node process (`src/server.ts`) with everything in memory -- no
database, no build step required at runtime (`tsx` runs the TypeScript directly; `npm run build`
+ `node dist/server.js` also works if you'd rather ship compiled JS). Game rooms are ephemeral
(lost on restart), which is fine for casual play. The only real size consideration is the bundled
asset directories this repo already ships: `image/` (~183MB) + `font/` (~6.3MB), which MUST be
deployed alongside `webport/` (the server reads them via `../image`, `../font`, i.e. one level
above `webport/`) -- don't `.gitignore`/prune them out of whatever you deploy.

Two reasonable options, in order of effort:

1. **A small VPS you already have/rent** (DigitalOcean, Hetzner, a home server, etc.) -- most
   control, no cold starts, cheapest to run 24/7:
   - `git clone` the repo, `cd webport && npm install && npm run build`.
   - Run it persistently: `pm2 start dist/server.js --name qsgs` (or a `systemd` unit, or this
     project's own `hub`-style process manager if you're driving it from an agent) with
     `restart: always`.
   - Put a reverse proxy in front for a real domain + automatic HTTPS -- Caddy is the least
     fuss (`example.com { reverse_proxy localhost:8787 }` in a `Caddyfile`, it gets a Let's
     Encrypt cert and proxies both the HTTP page AND the WebSocket upgrade automatically). nginx
     works too but needs the WS `Upgrade`/`Connection` headers forwarded explicitly.
   - Open port 443 (and 80 for the ACME challenge) in the VPS firewall; keep 8787 closed to the
     outside world (only Caddy talks to it, over localhost).

2. **A PaaS with a free/cheap tier** (Railway, Render, Fly.io) -- less setup, no server to patch,
   but check the platform's free-tier disk/image size limits against the ~190MB of bundled
   assets above:
   - Point it at this repo, build command `cd webport && npm install && npm run build`, start
     command `node webport/dist/server.js` (adjust paths to match the platform's working
     directory).
   - These platforms already terminate HTTPS and proxy WebSocket upgrades on the SAME public
     port automatically -- no reverse-proxy config needed, `PORT` is set for you via env var
     (the server already reads `process.env.PORT`).
   - Free tiers on these platforms typically sleep an idle service and cold-start on the next
     request -- fine for "play with friends when you're actually online", less fine for a
     server meant to be always-on/joinable at any time.

Either way, once it's reachable at `https://your-domain/`, anyone who opens that URL lands in the
same shared room lobby and can create/join rooms together -- no separate client install, nothing
to configure client-side.

## Run (local dev)

```
npm install
npm run sim      # engine smoke tests
npm run server   # serves the client AND the WebSocket API on :8787 -- open http://localhost:8787/
```

