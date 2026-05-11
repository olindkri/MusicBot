import "dotenv/config";
import { REST, Routes } from "discord.js";
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
if (!TOKEN || !CLIENT_ID) {
  console.error("DISCORD_TOKEN and DISCORD_CLIENT_ID must be set in .env");
  process.exit(1);
}

const commandsDir = join(__dirname, "commands");
const files = readdirSync(commandsDir).filter((f) => f.endsWith(".js"));

const payload = [];
for (const file of files) {
  const mod = (await import(pathToFileURL(join(commandsDir, file)).href)).default;
  payload.push(mod.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(TOKEN);

console.log(`[deploy] Registering ${payload.length} global commands...`);
const result = await rest.put(Routes.applicationCommands(CLIENT_ID), { body: payload });
console.log(`[deploy] Done. Discord returned ${Array.isArray(result) ? result.length : 0} commands.`);
console.log("[deploy] Note: global commands can take up to 1 hour to propagate to all servers.");
