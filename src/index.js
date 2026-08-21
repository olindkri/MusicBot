import "dotenv/config";
import { Client, Collection, GatewayIntentBits } from "discord.js";
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { createLavalink } from "./lavalink.js";
import { announce } from "./util/announce.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Collection();
client.buttons = new Collection();
client.lavalink = createLavalink(client);

async function loadModulesFrom(subdir, register) {
  const dir = join(__dirname, subdir);
  let files = [];
  try {
    files = readdirSync(dir).filter(f => f.endsWith(".js"));
  } catch (e) {
    if (e.code === "ENOENT") return;
    throw e;
  }
  for (const file of files) {
    const mod = (await import(pathToFileURL(join(dir, file)).href)).default;
    register(mod, file);
  }
}

await loadModulesFrom("events", (event) => {
  const handler = (...args) => event.execute(...args);
  if (event.once) client.once(event.name, handler);
  else client.on(event.name, handler);
});

await loadModulesFrom("commands", (cmd) => {
  client.commands.set(cmd.data.name, cmd);
});

await loadModulesFrom("buttons", (btn) => {
  client.buttons.set(btn.customId, btn);
});

// Announce downtime on the way out. Docker's stop grace period is short, so
// cap how long we wait rather than risking SIGKILL mid-send.
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received, announcing downtime`);
  try {
    await Promise.race([
      announce(client, "shutdown"),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
  } catch (err) {
    console.error("[shutdown] announce failed:", err);
  }
  try {
    await client.destroy();
  } catch {
    // Already tearing down.
  }
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});
process.on("uncaughtException", (err) => {
  // Deliberately does not announce or exit: transient gateway errors like
  // "Opening handshake has timed out" fire here routinely, and killing the
  // process on each one would restart-loop the bot and spam the channel.
  console.error("[uncaughtException]", err);
});

if (!process.env.DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN is not set. Did you create .env from .env.example?");
  process.exit(1);
}

await client.login(process.env.DISCORD_TOKEN);
