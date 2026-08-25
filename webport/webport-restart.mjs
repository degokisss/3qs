import WebSocket from "ws";
const ws = new WebSocket("ws://localhost:8787");
ws.on("open", () => { ws.send("new"); setTimeout(() => process.exit(0), 500); });
