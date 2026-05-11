import "dotenv/config";
import { Client, Collection, GatewayIntentBits } from "discord.js";
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { createLavalink } from "./lavalink.js";

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

process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

if (!process.env.DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN is not set. Did you create .env from .env.example?");
  process.exit(1);
}

await client.login(process.env.DISCORD_TOKEN);
