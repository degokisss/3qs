import WebSocket from "ws";

const ws = new WebSocket("ws://localhost:8787");
let count = 0;

ws.on("open", () => console.log("WS OPEN"));
ws.on("message", (raw) => {
  count++;
  const state = JSON.parse(raw.toString());
  console.log(`--- message ${count} --- turn=${state.turnNumber} acting=${state.currentPlayerId} gameOver=${JSON.stringify(state.gameOver)}`);
  console.log(
    "players:",
    state.players.map((p) => `${p.id}[${p.general}] hp=${p.hp}/${p.maxHp} role=${p.role ?? "?"} hand=${p.handcardNum} alive=${p.alive}`).join(" | "),
  );
  console.log("last log lines:", state.log.slice(-3));
  if (count >= 3) {
    ws.close();
    process.exit(0);
  }
});
ws.on("error", (e) => {
  console.error("WS ERROR", e);
  process.exit(1);
});
setTimeout(() => {
  console.error("TIMEOUT waiting for messages");
  process.exit(1);
}, 10000);
