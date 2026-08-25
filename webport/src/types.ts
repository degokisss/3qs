// Core enums ported from QSanguosha-For-Hegemony src/core/player.h (Player::Phase / Player::Place / Player::Role)
// and src/core/structs.h (DamageStruct). Kept 1:1 with the original names so later general/skill
// ports can be cross-checked line-by-line against the C++ source.

export enum Phase {
  RoundStart = "RoundStart",
  Start = "Start",
  Judge = "Judge",
  Draw = "Draw",
  Play = "Play",
  Discard = "Discard",
  Finish = "Finish",
  NotActive = "NotActive",
}

// Canonical phase order used by Room::run's per-player loop (gamerule.cpp GameRule::onPhaseProceed
// switches over exactly these seven active phases before falling back to NotActive for dead/skipped players).
export const PHASE_ORDER: Phase[] = [
  Phase.RoundStart,
  Phase.Start,
  Phase.Judge,
  Phase.Draw,
  Phase.Play,
  Phase.Discard,
  Phase.Finish,
];

export enum Place {
  PlaceHand = "PlaceHand",
  PlaceEquip = "PlaceEquip",
  PlaceDelayedTrick = "PlaceDelayedTrick",
  PlaceJudge = "PlaceJudge",
  DiscardPile = "DiscardPile",
  DrawPile = "DrawPile",
  PlaceTable = "PlaceTable",
}

// NOTE: the public QSanguosha-For-Hegemony `dev` branch (src/core/engine.cpp, Engine::getRoles)
// only ever emits 'Z' (lord) and 'N' (renegade) for the standard "0Xp" modes -- it has no 'C'
// (loyalist) / 'F' (rebel) entries, so its identity-mode role table is not the balanced classic
// mode. We intentionally do NOT port that table; see gamerule.ts for the canonical role counts
// used here instead (sourced from the official published Sanguosha role-mode rules, not code).
export enum Role {
  Lord = "lord",
  Loyalist = "loyalist",
  Rebel = "rebel",
  Renegade = "renegade",
}

export enum DamageNature {
  Normal = "Normal",
  Fire = "Fire",
  Thunder = "Thunder",
}

export interface DamageStruct {
  from: string | null; // player id, null = no source (e.g. self-inflicted by rule)
  to: string;
  damage: number;
  nature: DamageNature;
}
