// Card model. The card LIST and exact per-card suit/point are ported 1:1 from this project's
// actual source (src/package/standard-basics.cpp basicCards(), standard-tricks.cpp trickCards(),
// standard-equips.cpp equipCards()) rather than the physical board game's box contents -- this
// software's card pool differs from the boxed Standard set (e.g. only 1 Crossbow, not 2; extra
// cards like AwaitExhausted/KnownBoth/BefriendAttacking not in the original box; only 6 horses,
// not 7).
//
// Only card kinds with resolution logic implemented (combat.ts / trick.ts) are dealt by
// Room. Kinds present in the real source but NOT YET resolvable are explicitly excluded here
// rather than silently dropped:
//   Trick: Indulgence, SupplyShortage, FireAttack, Lightning, Collateral, BefriendAttacking,
//     AwaitExhausted, IronChain, Nullification, HegNullification, KnownBoth WERE all in this
//     list at some point across earlier milestones -- each turned out to fit (or extend)
//     existing engine machinery; see each one's own resolver in trick.ts for the exact
//     reasoning (Milestone 31's header there covers the last 3 -- the reactive counter-play
//     window and the private-reveal channel).
//   Equip: EightDiagram/RenwangShield/Vine/SilverLion (the 4 Standard armors, Milestone 34) WAS
//     in this list too -- turned out to need only a 4th equip SLOT (`player.armor`, alongside
//     the existing weapon/defenseHorse/offenseHorse) plus a handful of new hook points already
//     shaped for exactly this kind of thing: 3 of the 4 are "Tỏa định kỹ" (locked, always-on,
//     no ask) -- RenwangShield/Vine nullify a Slash/AOE outright inside `resolveSlash`/
//     `resolveSavageAssault`/`resolveArcheryAttack` (same `Global_NonSkillNullify`-equivalent
//     early-return already used for Weimu's black-trick immunity), SilverLion caps damage and
//     Vine adds +1 Fire damage inside the single shared `applyDamage` choke point every damage
//     source already flows through. Only EightDiagram needed a genuinely NEW ask
//     (`askUseEightDiagram`) -- an optional judgment-based backup dodge, offered when no real/
//     viewAs Jink was found, reusing the existing `judge()` helper. See combat.ts's
//     `applyDamage`/`resolveSlash` headers and trick.ts's AOE resolvers for the exact hooks.
// AmazingGrace/GodSalvation/ArcheryAttack are constructed with no suit/point in the source
// (`new ArcheryAttack` etc.) -- modeled here with a placeholder Spade/0, since no implemented
// mechanic reads their suit yet.

import { DamageNature } from "./types.js";

export enum Suit {
  Spade = "spade",
  Heart = "heart",
  Club = "club",
  Diamond = "diamond",
}

export enum CardKind {
  Slash = "slash",
  Jink = "jink",
  Peach = "peach",
  Analeptic = "analeptic",
  AmazingGrace = "amazing_grace",
  GodSalvation = "god_salvation",
  SavageAssault = "savage_assault",
  ArcheryAttack = "archery_attack",
  Duel = "duel",
  ExNihilo = "ex_nihilo",
  Snatch = "snatch",
  Dismantlement = "dismantlement",
  Indulgence = "indulgence",
  SupplyShortage = "supply_shortage",
  FireAttack = "fire_attack",
  Lightning = "lightning",
  Collateral = "collateral",
  BefriendAttacking = "befriend_attacking",
  AwaitExhausted = "await_exhausted",
  IronChain = "iron_chain",
  Nullification = "nullification",
  HegNullification = "heg_nullification",
  KnownBoth = "known_both",
  Weapon = "weapon",
  Horse = "horse",
  Armor = "armor",
}

export interface Card {
  id: number;
  kind: CardKind;
  suit: Suit;
  point: number;
  nature?: DamageNature; // Slash only
  weaponName?: string;
  weaponRange?: number; // Weapon only, src/package/standard-equips.cpp Weapon(suit, number, range)
  horseName?: string;
  horseDelta?: number; // Horse only: +1 defensive, -1 offensive
  armorName?: string; // Armor only
  /** True only for `makeVirtualSlash()`'s output -- a card that was never part of the dealt
   *  deck (see its own doc comment). Lets card-count invariants (e.g. simulate.ts's
   *  `totalCardsInPlay`) exclude it instead of drifting the expected total. */
  virtual?: boolean;
}

let nextId = 0;
function card(kind: CardKind, suit: Suit, point: number, extra: Partial<Card> = {}): Card {
  return { id: nextId++, kind, suit, point, ...extra };
}

/** A free bonus Slash with no backing physical card (e.g. Jiling's Shuangren: `Slash(Card::
 *  NoSuit, 0)` in the real upstream source) -- gets a fresh unique id from the same counter
 *  every other card uses, so it discards/logs like a normal card, just never actually sat in
 *  anyone's hand or the draw pile. Suit/point are cosmetic placeholders (no game logic reads a
 *  Slash's own suit/point once played), matching this file's existing "no implemented suit/
 *  point source" precedent for AmazingGrace/GodSalvation/ArcheryAttack's own placeholders. */
export function makeVirtualSlash(): Card {
  return card(CardKind.Slash, Suit.Spade, 0, { virtual: true });
}

function basicCards(): Card[] {
  const S = Suit.Spade, H = Suit.Heart, C = Suit.Club, D = Suit.Diamond;
  return [
    // Slash (Normal nature), 21 cards
    card(CardKind.Slash, S, 5), card(CardKind.Slash, S, 7), card(CardKind.Slash, S, 8),
    card(CardKind.Slash, S, 8), card(CardKind.Slash, S, 9), card(CardKind.Slash, S, 10),
    card(CardKind.Slash, S, 11),
    card(CardKind.Slash, C, 2), card(CardKind.Slash, C, 3), card(CardKind.Slash, C, 4),
    card(CardKind.Slash, C, 5), card(CardKind.Slash, C, 8), card(CardKind.Slash, C, 9),
    card(CardKind.Slash, C, 10), card(CardKind.Slash, C, 11), card(CardKind.Slash, C, 11),
    card(CardKind.Slash, H, 10), card(CardKind.Slash, H, 12),
    card(CardKind.Slash, D, 10), card(CardKind.Slash, D, 11), card(CardKind.Slash, D, 12),
    // FireSlash, 3 cards
    card(CardKind.Slash, H, 4, { nature: DamageNature.Fire }),
    card(CardKind.Slash, D, 4, { nature: DamageNature.Fire }),
    card(CardKind.Slash, D, 5, { nature: DamageNature.Fire }),
    // ThunderSlash, 5 cards
    card(CardKind.Slash, S, 6, { nature: DamageNature.Thunder }),
    card(CardKind.Slash, S, 7, { nature: DamageNature.Thunder }),
    card(CardKind.Slash, C, 6, { nature: DamageNature.Thunder }),
    card(CardKind.Slash, C, 7, { nature: DamageNature.Thunder }),
    card(CardKind.Slash, C, 8, { nature: DamageNature.Thunder }),
    // Jink, 14 cards
    card(CardKind.Jink, H, 2), card(CardKind.Jink, H, 11), card(CardKind.Jink, H, 13),
    card(CardKind.Jink, D, 2), card(CardKind.Jink, D, 3), card(CardKind.Jink, D, 6),
    card(CardKind.Jink, D, 7), card(CardKind.Jink, D, 7), card(CardKind.Jink, D, 8),
    card(CardKind.Jink, D, 8), card(CardKind.Jink, D, 9), card(CardKind.Jink, D, 10),
    card(CardKind.Jink, D, 11), card(CardKind.Jink, D, 13),
    // Peach, 8 cards
    card(CardKind.Peach, H, 4), card(CardKind.Peach, H, 6), card(CardKind.Peach, H, 7),
    card(CardKind.Peach, H, 8), card(CardKind.Peach, H, 9), card(CardKind.Peach, H, 10),
    card(CardKind.Peach, H, 12), card(CardKind.Peach, D, 2),
    // Analeptic, 3 cards
    card(CardKind.Analeptic, S, 9), card(CardKind.Analeptic, C, 9), card(CardKind.Analeptic, D, 9),
  ];
}

function implementedTrickCards(): Card[] {
  const S = Suit.Spade, H = Suit.Heart, C = Suit.Club, D = Suit.Diamond;
  return [
    card(CardKind.AmazingGrace, S, 0),
    card(CardKind.GodSalvation, S, 0),
    card(CardKind.SavageAssault, S, 13), card(CardKind.SavageAssault, C, 7),
    card(CardKind.ArcheryAttack, S, 0),
    card(CardKind.Duel, S, 1), card(CardKind.Duel, C, 1),
    card(CardKind.ExNihilo, H, 7), card(CardKind.ExNihilo, H, 8),
    card(CardKind.Snatch, S, 3), card(CardKind.Snatch, S, 4), card(CardKind.Snatch, D, 3),
    card(CardKind.Dismantlement, S, 3), card(CardKind.Dismantlement, S, 4), card(CardKind.Dismantlement, H, 12),
    // Real Sanguosha standard ships 3 (Club 6/Heart 6/Spade 6, deliberately no Diamond so
    // Guose's Diamond-only viewAs conversion is the only way to get a diamond-suited one) --
    // this repo's dev-branch source only carries 2, per this file's header; picking 2 of the 3
    // real suit/point combos (suit has no functional effect either way -- only the freshly
    // drawn judgment card's suit matters, never the Indulgence card's own).
    card(CardKind.Indulgence, C, 6), card(CardKind.Indulgence, S, 6),
    // Real Sanguosha ships 2: Spade 10, Club 10 (verified exactly against this repo's actual
    // `dev`-branch source, `trickCards()`'s `new SupplyShortage(Card::Spade, 10) << new
    // SupplyShortage(Card::Club, 10)`).
    card(CardKind.SupplyShortage, S, 10), card(CardKind.SupplyShortage, C, 10),
    // Real Sanguosha ships 2: Heart 2, Heart 3 (verified against this repo's actual `dev`-branch
    // source, `trickCards()`'s `new FireAttack(Card::Heart, 2) << new FireAttack(Card::Heart, 3)`).
    card(CardKind.FireAttack, H, 2), card(CardKind.FireAttack, H, 3),
    // Real Sanguosha ships 1, constructed with no suit/point in the source (`new Lightning` at
    // the end of `trickCards()`) -- same "no implemented mechanic reads a delayed trick's own
    // suit/point, only the freshly-drawn judgment card's suit matters" precedent as Indulgence/
    // SupplyShortage, modeled with the same placeholder Spade/0 this file already uses for
    // AmazingGrace/GodSalvation/ArcheryAttack.
    card(CardKind.Lightning, S, 0),
    // Real Sanguosha ships 1 each, both constructed with no suit/point in the source (`new
    // Collateral` / `new BefriendAttacking`) -- same placeholder-Spade/0 precedent as
    // AmazingGrace/GodSalvation/ArcheryAttack/Lightning above (no implemented mechanic reads
    // either card's own suit/point).
    card(CardKind.Collateral, S, 0),
    card(CardKind.BefriendAttacking, S, 0),
    // Real Sanguosha ships 2: Heart 11, Diamond 4 (verified against this repo's actual
    // `dev`-branch source, `trickCards()`'s `new AwaitExhausted(Card::Heart, 11) << new
    // AwaitExhausted(Card::Diamond, 4)`).
    card(CardKind.AwaitExhausted, H, 11), card(CardKind.AwaitExhausted, D, 4),
    // Real Sanguosha ships 3: Spade 12, Club 12, Club 13 (verified against this repo's actual
    // `dev`-branch source, `trickCards()`'s `new IronChain(Card::Spade, 12) << new
    // IronChain(Card::Club, 12) << new IronChain(Card::Club, 13)`).
    card(CardKind.IronChain, S, 12), card(CardKind.IronChain, C, 12), card(CardKind.IronChain, C, 13),
    // Real Sanguosha ships 1, constructed with no explicit suit/point in the source (`new
    // Nullification` -- the base class default is `Spade, 11`, per standard-tricks.h's
    // `Q_INVOKABLE Nullification(Card::Suit suit = Spade, int number = 11)`).
    card(CardKind.Nullification, S, 11),
    // Real Sanguosha ships 2: Club 13, Diamond 12 (verified against this repo's actual
    // `dev`-branch source, `trickCards()`'s `new HegNullification(Card::Club, 13) << new
    // HegNullification(Card::Diamond, 12)`).
    card(CardKind.HegNullification, C, 13), card(CardKind.HegNullification, D, 12),
    // Real Sanguosha ships 2: Club 3, Club 4 (verified against this repo's actual `dev`-branch
    // source, `trickCards()`'s `new KnownBoth(Card::Club, 3) << new KnownBoth(Card::Club, 4)`).
    card(CardKind.KnownBoth, C, 3), card(CardKind.KnownBoth, C, 4),
  ];
}

// [name, suit, point, range]
const WEAPONS: [string, Suit, number, number][] = [
  ["Crossbow", Suit.Diamond, 1, 1],
  ["DoubleSword", Suit.Spade, 2, 2],
  ["QinggangSword", Suit.Spade, 6, 2],
  ["IceSword", Suit.Spade, 2, 2],
  ["Spear", Suit.Spade, 12, 3],
  ["Axe", Suit.Diamond, 5, 3],
  ["KylinBow", Suit.Heart, 5, 5],
  ["Fan", Suit.Diamond, 1, 4],
  ["SixSwords", Suit.Diamond, 6, 2],
  ["Triblade", Suit.Diamond, 12, 3],
];

// [name, suit, point, delta]
const HORSES: [string, Suit, number, number][] = [
  ["JueYing", Suit.Spade, 5, 1],
  ["DiLu", Suit.Club, 5, 1],
  ["ZhuaHuangFeiDian", Suit.Heart, 13, 1],
  ["ChiTu", Suit.Heart, 5, -1],
  ["DaYuan", Suit.Spade, 13, -1],
  ["ZiXing", Suit.Diamond, 13, -1],
];

// [name, suit, point]
const ARMORS: [string, Suit, number][] = [
  ["EightDiagram", Suit.Spade, 2],
  ["RenwangShield", Suit.Club, 2],
  ["Vine", Suit.Club, 2],
  ["SilverLion", Suit.Club, 1],
];

function equipCards(): Card[] {
  const weapons = WEAPONS.map(([name, suit, point, range]) =>
    card(CardKind.Weapon, suit, point, { weaponName: name, weaponRange: range }),
  );
  const horses = HORSES.map(([name, suit, point, delta]) =>
    card(CardKind.Horse, suit, point, { horseName: name, horseDelta: delta }),
  );
  const armors = ARMORS.map(([name, suit, point]) => card(CardKind.Armor, suit, point, { armorName: name }));
  return [...weapons, ...horses, ...armors];
}

/** Full deck actually dealt by Room: basics + the implemented trick/equip subset (108 cards). */
export function buildStandardDeck(): Card[] {
  return [...basicCards(), ...implementedTrickCards(), ...equipCards()];
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
