# Discord Music Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted Discord music bot with 9 slash commands and a 4-button interactive now-playing card, supporting YouTube/Spotify/SoundCloud (+15 more sources via LavaSrc) with SponsorBlock segment skipping.

**Architecture:** Two-container Docker Compose stack — a Node.js bot using `discord.js` v14 and `lavalink-client`, plus a Lavalink v4 service with LavaSrc and SponsorBlock plugins. Bot maintains an outbound Discord Gateway connection; Lavalink handles all audio source resolution, decoding, and Opus streaming.

**Tech Stack:** Node.js 20, discord.js v14, lavalink-client, Lavalink v4 (Java), LavaSrc plugin, SponsorBlock plugin, Docker Compose.

**Spec reference:** `docs/superpowers/specs/2026-05-11-discord-music-bot-design.md`

**Testing note:** Per the spec, v1 has no unit test suite. The bot is thin glue over `lavalink-client` and `discord.js`. Each task ends with an explicit verification step (log output, manual Discord interaction, or `docker compose` command) instead of `pytest`/`jest`. Verification is non-negotiable — do not commit until the listed expectation is met.

**Required environment for execution:**
- Linux host (or macOS — Docker Compose works either way for development)
- Docker Engine 24+ and Docker Compose v2 plugin
- A Discord application + bot token from https://discord.com/developers/applications
  - `MESSAGE CONTENT INTENT` not required (slash commands only)
  - `Server Members Intent` not required
  - OAuth2 invite scopes: `bot`, `applications.commands`
  - Bot permissions: `View Channels`, `Send Messages`, `Embed Links`, `Connect`, `Speak`, `Use Voice Activity`
- A test Discord server with at least one voice channel
- (Optional) Spotify API client credentials from https://developer.spotify.com/dashboard for richer Spotify metadata

---

## File Structure

```
MusicBot/
├── .env.example
├── .gitignore
├── .dockerignore
├── docker-compose.yml
├── Dockerfile
├── package.json
├── package-lock.json
├── README.md
├── docs/superpowers/
│   ├── specs/2026-05-11-discord-music-bot-design.md
│   └── plans/2026-05-11-discord-music-bot.md         # this file
├── lavalink/
│   ├── application.yml
│   └── plugins/                                       # auto-populated by Lavalink on first run
└── src/
    ├── index.js                                       # client bootstrap + login
    ├── lavalink.js                                    # LavalinkManager setup + player event handlers
    ├── deploy-commands.js                             # one-shot global slash command registration
    ├── state.js                                       # in-memory per-guild state (now-playing message IDs, leave timers)
    ├── commands/
    │   ├── play.js
    │   ├── pause.js
    │   ├── resume.js
    │   ├── skip.js
    │   ├── stop.js
    │   ├── queue.js
    │   ├── nowplaying.js
    │   ├── disconnect.js
    │   └── shuffle.js
    ├── buttons/
    │   ├── playPause.js
    │   ├── skip.js
    │   ├── stop.js
    │   └── shuffle.js
    ├── components/
    │   └── nowPlayingCard.js
    ├── events/
    │   ├── ready.js
    │   ├── interactionCreate.js
    │   └── voiceStateUpdate.js
    └── util/
        ├── embeds.js
        ├── permissions.js
        └── formatDuration.js
```

---

## Phase 1 — Scaffolding & Container Smoke Test

### Task 1: Initialise repo and Node project

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.dockerignore`
- Create: `.env.example`

- [ ] **Step 1: Initialise git**

Run:
```bash
cd /Users/olindkri/Projects/MusicBot
git init -b main
```
Expected: `Initialized empty Git repository in .../MusicBot/.git/`

- [ ] **Step 2: Create `package.json`**

Create `package.json`:
```json
{
  "name": "musicbot",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "start": "node src/index.js",
    "deploy": "node src/deploy-commands.js"
  },
  "dependencies": {
    "discord.js": "^14.16.3",
    "lavalink-client": "^2.5.4",
    "dotenv": "^16.4.5"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run:
```bash
npm install
```
Expected: `package-lock.json` created, `node_modules/` populated, no errors.

- [ ] **Step 4: Create `.gitignore`**

Create `.gitignore`:
```
node_modules/
.env
.env.local
lavalink/plugins/
lavalink/logs/
*.log
.DS_Store
```

- [ ] **Step 5: Create `.dockerignore`**

Create `.dockerignore`:
```
node_modules
.env
.env.local
.git
.gitignore
docs
*.md
lavalink/plugins
lavalink/logs
```

- [ ] **Step 6: Create `.env.example`**

Create `.env.example`:
```
# Discord bot credentials (https://discord.com/developers/applications)
DISCORD_TOKEN=your-bot-token-here
DISCORD_CLIENT_ID=your-application-id-here

# Lavalink server (must match lavalink/application.yml)
LAVALINK_HOST=lavalink
LAVALINK_PORT=2333
LAVALINK_PASSWORD=changeme

# Optional: enables richer Spotify metadata via LavaSrc
# Get from https://developer.spotify.com/dashboard
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
```

- [ ] **Step 7: Commit**

Run:
```bash
git add package.json package-lock.json .gitignore .dockerignore .env.example docs/
git commit -m "feat: initialise Node project and repo metadata"
```

---

### Task 2: Lavalink config with LavaSrc + SponsorBlock plugins

**Files:**
- Create: `lavalink/application.yml`

- [ ] **Step 1: Create `lavalink/application.yml`**

Create `lavalink/application.yml`:
```yaml
server:
  port: 2333
  address: 0.0.0.0
  http2:
    enabled: false

plugins:
  lavasrc:
    providers:
      - "ytsearch:\"%ISRC%\""
      - "ytsearch:%QUERY%"
    sources:
      spotify: true
      applemusic: true
      deezer: true
      yandexmusic: false
      flowery-tts: false
      youtube: true
    spotify:
      clientId: "${SPOTIFY_CLIENT_ID:}"
      clientSecret: "${SPOTIFY_CLIENT_SECRET:}"
      countryCode: "US"
    applemusic:
      countryCode: "US"
    deezer:
      masterDecryptionKey: ""
  youtube:
    enabled: true
    allowSearch: true
    allowDirectVideoIds: true
    allowDirectPlaylistIds: true
    clients:
      - MUSIC
      - ANDROID_TESTSUITE
      - WEB
      - TVHTML5EMBEDDED
  sponsorblock:
    enabled: true
    categories:
      - sponsor
      - selfpromo
      - interaction
      - intro
      - outro
      - preview
      - music_offtopic

lavalink:
  plugins:
    - dependency: "dev.lavalink.youtube:youtube-plugin:1.11.4"
      snapshot: false
    - dependency: "com.github.topi314.lavasrc:lavasrc-plugin:4.2.0"
      snapshot: false
    - dependency: "com.github.topi314.sponsorblock:sponsorblock-plugin:3.0.1"
      snapshot: false
  pluginsDir: "./plugins"
  server:
    password: "${LAVALINK_PASSWORD:changeme}"
    sources:
      youtube: false        # disabled here — handled by youtube-plugin
      bandcamp: true
      soundcloud: true
      twitch: true
      vimeo: true
      http: true
      local: false
    bufferDurationMs: 400
    frameBufferDurationMs: 5000
    opusEncodingQuality: 10
    resamplingQuality: LOW
    trackStuckThresholdMs: 10000
    useSeekGhosting: true
    youtubePlaylistLoadLimit: 6
    playerUpdateInterval: 5
    youtubeSearchEnabled: true
    soundcloudSearchEnabled: true

logging:
  level:
    root: INFO
    lavalink: INFO
```

- [ ] **Step 2: Commit**

Run:
```bash
git add lavalink/application.yml
git commit -m "feat: add Lavalink config with LavaSrc, YouTube, and SponsorBlock plugins"
```

---

### Task 3: Dockerfile for the bot

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Create `Dockerfile`**

Create `Dockerfile`:
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
```

- [ ] **Step 2: Commit**

Run:
```bash
git add Dockerfile
git commit -m "feat: add bot Dockerfile (node:20-alpine)"
```

---

### Task 4: Docker Compose

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create `docker-compose.yml`**

Create `docker-compose.yml`:
```yaml
services:
  lavalink:
    image: ghcr.io/lavalink-devs/lavalink:4
    container_name: musicbot-lavalink
    restart: unless-stopped
    environment:
      - _JAVA_OPTIONS=-Xmx512M
      - SERVER_PORT=2333
      - LAVALINK_SERVER_PASSWORD=${LAVALINK_PASSWORD:-changeme}
      - SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID:-}
      - SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET:-}
    volumes:
      - ./lavalink/application.yml:/opt/Lavalink/application.yml:ro
      - ./lavalink/plugins:/opt/Lavalink/plugins
    networks:
      - musicbot

  bot:
    build: .
    container_name: musicbot-bot
    restart: unless-stopped
    depends_on:
      - lavalink
    env_file: .env
    networks:
      - musicbot

networks:
  musicbot:
    driver: bridge
```

- [ ] **Step 2: Create a working `.env` from the example**

Run:
```bash
cp .env.example .env
```
Then edit `.env` and set at minimum `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and `LAVALINK_PASSWORD` to real values. The Discord token/client id come from the Discord Developer Portal. Pick any strong random string for `LAVALINK_PASSWORD`.

- [ ] **Step 3: Verify Lavalink starts and loads plugins**

Run:
```bash
docker compose up -d lavalink
docker compose logs -f lavalink
```
Expected within ~30s: log lines containing `Started LavalinkApplication`, `Loaded plugin youtube-plugin`, `Loaded plugin lavasrc-plugin`, `Loaded plugin sponsorblock-plugin`, and `Lavalink is ready to accept connections`.

Stop tailing with Ctrl-C, then verify Lavalink is up:
```bash
docker compose ps lavalink
```
Expected: `STATUS` shows `Up ...`.

Note: if the bot is started before Lavalink finishes booting, `lavalink-client` will log a transient `node disconnected` and reconnect automatically once Lavalink is ready. This is fine — no manual intervention needed.

- [ ] **Step 4: Commit**

Run:
```bash
git add docker-compose.yml
git commit -m "feat: add docker-compose with healthchecked Lavalink + bot services"
```

---

## Phase 2 — Bot bootstrap & Lavalink wiring

### Task 5: Discord client bootstrap

**Files:**
- Create: `src/index.js`
- Create: `src/state.js`
- Create: `src/events/ready.js`

- [ ] **Step 1: Create `src/state.js`**

Create `src/state.js`:
```js
// In-memory per-guild state. Resets on bot restart (by design for v1).
//
// Shape per guild:
//   {
//     nowPlayingMessageId: string | null,   // id of the now-playing card message
//     nowPlayingChannelId: string | null,   // text channel the card lives in
//     leaveTimer: NodeJS.Timeout | null,    // auto-disconnect timer when voice channel empty
//   }
const guildState = new Map();

export function getGuildState(guildId) {
  if (!guildState.has(guildId)) {
    guildState.set(guildId, {
      nowPlayingMessageId: null,
      nowPlayingChannelId: null,
      leaveTimer: null,
    });
  }
  return guildState.get(guildId);
}

export function clearGuildState(guildId) {
  const s = guildState.get(guildId);
  if (s?.leaveTimer) clearTimeout(s.leaveTimer);
  guildState.delete(guildId);
}
```

- [ ] **Step 2: Create `src/events/ready.js`**

Create `src/events/ready.js`:
```js
import { Events } from "discord.js";

export default {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`[discord] Logged in as ${client.user.tag} (id: ${client.user.id})`);
    console.log(`[discord] Serving ${client.guilds.cache.size} guild(s)`);
  },
};
```

- [ ] **Step 3: Create `src/index.js`**

Create `src/index.js`:
```js
import "dotenv/config";
import { Client, Collection, GatewayIntentBits } from "discord.js";
import { readdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.commands = new Collection();
client.buttons = new Collection();

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
```

- [ ] **Step 4: Verify login works**

Build and start:
```bash
docker compose up -d --build
docker compose logs -f bot
```
Expected within 10s:
- `[discord] Logged in as <BotName>#0000 (id: ...)`
- `[discord] Serving N guild(s)` — `N` will be `0` until you invite the bot to a server via the OAuth2 URL from the Discord developer portal. Invite the bot now (scopes: `bot`, `applications.commands`), then restart with `docker compose restart bot` and the count will update.

If you see `DISCORD_TOKEN is not set`, fix `.env` and `docker compose up -d --force-recreate bot`.

Stop tailing with Ctrl-C.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/index.js src/state.js src/events/ready.js
git commit -m "feat: bot bootstrap with module autoloading and Discord login"
```

---

### Task 6: Lavalink manager wiring

**Files:**
- Create: `src/lavalink.js`
- Modify: `src/index.js`

- [ ] **Step 1: Create `src/lavalink.js`**

Create `src/lavalink.js`:
```js
import { LavalinkManager } from "lavalink-client";

export function createLavalink(client) {
  const manager = new LavalinkManager({
    nodes: [{
      id: "main",
      host: process.env.LAVALINK_HOST || "lavalink",
      port: Number(process.env.LAVALINK_PORT || 2333),
      authorization: process.env.LAVALINK_PASSWORD || "changeme",
      secure: false,
    }],
    sendToShard: (guildId, payload) =>
      client.guilds.cache.get(guildId)?.shard?.send(payload),
    client: {
      id: process.env.DISCORD_CLIENT_ID,
      username: "MusicBot",
    },
    autoSkip: true,
    playerOptions: {
      defaultSearchPlatform: "ytsearch",
      onDisconnect: { autoReconnect: true, destroyPlayer: false },
      onEmptyQueue: { destroyAfterMs: 30_000 },
    },
  });

  manager.nodeManager.on("connect", (node) =>
    console.log(`[lavalink] Node "${node.id}" connected`)
  );
  manager.nodeManager.on("error", (node, err) =>
    console.error(`[lavalink] Node "${node.id}" error:`, err.message)
  );
  manager.nodeManager.on("disconnect", (node, reason) =>
    console.warn(`[lavalink] Node "${node.id}" disconnected:`, reason)
  );

  // Bridge raw Discord voice updates to Lavalink.
  client.on("raw", (d) => manager.sendRawData(d));
  client.once("ready", () => manager.init({ id: client.user.id, username: client.user.username }));

  return manager;
}
```

- [ ] **Step 2: Wire it into `src/index.js`**

Modify `src/index.js` — add the import near the top (after the discord.js import) and the initialisation call before the event autoload:

Add after the `import { dirname, join } from "node:path";` line:
```js
import { createLavalink } from "./lavalink.js";
```

Add immediately after `client.buttons = new Collection();`:
```js
client.lavalink = createLavalink(client);
```

- [ ] **Step 3: Verify Lavalink connection**

Rebuild and tail:
```bash
docker compose up -d --build bot
docker compose logs -f bot
```
Expected within 5s after login:
- `[lavalink] Node "main" connected`

Stop tailing with Ctrl-C.

- [ ] **Step 4: Commit**

Run:
```bash
git add src/lavalink.js src/index.js
git commit -m "feat: connect to Lavalink node on bot startup"
```

---

## Phase 3 — Slash command infrastructure & first command

### Task 7: Utility helpers

**Files:**
- Create: `src/util/embeds.js`
- Create: `src/util/permissions.js`
- Create: `src/util/formatDuration.js`

- [ ] **Step 1: Create `src/util/formatDuration.js`**

Create `src/util/formatDuration.js`:
```js
export function formatDuration(ms) {
  if (!ms || ms < 0 || !Number.isFinite(ms)) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}
```

- [ ] **Step 2: Create `src/util/embeds.js`**

Create `src/util/embeds.js`:
```js
import { EmbedBuilder } from "discord.js";

export const COLORS = {
  brand: 0x5865F2,
  success: 0x57F287,
  warn: 0xFEE75C,
  error: 0xED4245,
};

export function errorEmbed(message) {
  return new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${message}`);
}

export function infoEmbed(message) {
  return new EmbedBuilder().setColor(COLORS.brand).setDescription(message);
}

export function successEmbed(message) {
  return new EmbedBuilder().setColor(COLORS.success).setDescription(`✅ ${message}`);
}
```

- [ ] **Step 3: Create `src/util/permissions.js`**

Create `src/util/permissions.js`:
```js
import { errorEmbed } from "./embeds.js";

// Returns the voice channel id the user is in, or null.
export function userVoiceChannelId(interaction) {
  return interaction.member?.voice?.channelId ?? null;
}

// Guard: user must be in some voice channel. Replies ephemerally and returns false on failure.
export async function ensureInVoice(interaction) {
  const vc = userVoiceChannelId(interaction);
  if (!vc) {
    await interaction.reply({
      embeds: [errorEmbed("Join a voice channel first.")],
      ephemeral: true,
    });
    return false;
  }
  return true;
}

// Guard: user must be in the SAME voice channel as the bot's player.
// Pass the active player (may be null/undefined; treated as no player active).
export async function ensureSameVoice(interaction, player) {
  if (!(await ensureInVoice(interaction))) return false;
  if (!player || !player.voiceChannelId) return true; // bot not connected yet — allow
  const vc = userVoiceChannelId(interaction);
  if (vc !== player.voiceChannelId) {
    await interaction.reply({
      embeds: [errorEmbed("You need to be in the same voice channel as the bot.")],
      ephemeral: true,
    });
    return false;
  }
  return true;
}
```

- [ ] **Step 4: Commit**

Run:
```bash
git add src/util/
git commit -m "feat: add embed, permission, and duration utilities"
```

---

### Task 8: Now-playing card builder

**Files:**
- Create: `src/components/nowPlayingCard.js`

- [ ] **Step 1: Create `src/components/nowPlayingCard.js`**

Create `src/components/nowPlayingCard.js`:
```js
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { COLORS } from "../util/embeds.js";
import { formatDuration } from "../util/formatDuration.js";

const SOURCE_LABELS = {
  youtube: "YouTube",
  ytmusic: "YouTube Music",
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  applemusic: "Apple Music",
  deezer: "Deezer",
  tidal: "Tidal",
  bandcamp: "Bandcamp",
  twitch: "Twitch",
  vimeo: "Vimeo",
  http: "Direct",
};

function sourceLabel(src) {
  if (!src) return "Unknown";
  return SOURCE_LABELS[src] || src;
}

export function buildNowPlayingEmbed(track) {
  const info = track.info;
  const requester = track.requester;
  const requesterMention = requester?.id ? `<@${requester.id}>` : "unknown";

  const embed = new EmbedBuilder()
    .setColor(COLORS.brand)
    .setTitle(info.title || "Unknown title")
    .setURL(info.uri || null)
    .setAuthor({ name: "▶ Now playing" })
    .addFields(
      { name: "Artist", value: info.author || "Unknown", inline: true },
      { name: "Duration", value: info.isStream ? "🔴 LIVE" : formatDuration(info.duration), inline: true },
      { name: "Source", value: sourceLabel(info.sourceName), inline: true },
    )
    .setFooter({ text: `Requested by ${requester?.username ?? "unknown"}` });

  if (info.artworkUrl) embed.setThumbnail(info.artworkUrl);
  return embed;
}

export function buildNowPlayingRow(player) {
  const paused = player?.paused === true;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("np:playpause")
      .setLabel(paused ? "Resume" : "Pause")
      .setEmoji(paused ? "▶️" : "⏸️")
      .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("np:skip")
      .setLabel("Skip")
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("np:stop")
      .setLabel("Stop")
      .setEmoji("⏹️")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("np:shuffle")
      .setLabel("Shuffle")
      .setEmoji("🔀")
      .setStyle(ButtonStyle.Secondary),
  );
}

export function buildNowPlayingMessage(track, player) {
  return {
    embeds: [buildNowPlayingEmbed(track)],
    components: [buildNowPlayingRow(player)],
  };
}

// Builds an inert "queue ended" terminal state for the same card.
export function buildQueueEndedMessage() {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.warn)
        .setAuthor({ name: "⏹ Queue ended" })
        .setDescription("Nothing left to play. Use `/play` to add more."),
    ],
    components: [],
  };
}
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/components/nowPlayingCard.js
git commit -m "feat: now-playing embed + 4-button action row"
```

---

### Task 9: Interaction router (slash + buttons)

**Files:**
- Create: `src/events/interactionCreate.js`

- [ ] **Step 1: Create `src/events/interactionCreate.js`**

Create `src/events/interactionCreate.js`:
```js
import { Events, MessageFlags } from "discord.js";
import { errorEmbed } from "../util/embeds.js";

async function safeErrorReply(interaction, message) {
  const payload = {
    embeds: [errorEmbed(message)],
    flags: MessageFlags.Ephemeral,
  };
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch (err) {
    console.error("[interactionCreate] failed to send error reply:", err);
  }
}

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        const cmd = interaction.client.commands.get(interaction.commandName);
        if (!cmd) {
          return safeErrorReply(interaction, `Unknown command: ${interaction.commandName}`);
        }
        await cmd.execute(interaction);
        return;
      }

      if (interaction.isButton()) {
        const handler = interaction.client.buttons.get(interaction.customId);
        if (!handler) {
          // Stale button from a previous bot session — fail soft.
          return safeErrorReply(interaction, "This button is no longer active. Run `/play` again.");
        }
        await handler.execute(interaction);
        return;
      }
    } catch (err) {
      console.error(`[interactionCreate] handler threw for ${interaction.commandName ?? interaction.customId}:`, err);
      await safeErrorReply(interaction, "Something went wrong. The error has been logged.");
    }
  },
};
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/events/interactionCreate.js
git commit -m "feat: interaction router for slash commands and buttons"
```

---

### Task 10: `/play` command

**Files:**
- Create: `src/commands/play.js`

- [ ] **Step 1: Create `src/commands/play.js`**

Create `src/commands/play.js`:
```js
import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { ensureInVoice, ensureSameVoice, userVoiceChannelId } from "../util/permissions.js";
import { errorEmbed, infoEmbed } from "../util/embeds.js";
import { formatDuration } from "../util/formatDuration.js";

export default {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a track or playlist from a URL or search query.")
    .addStringOption((opt) =>
      opt.setName("query").setDescription("URL or search terms").setRequired(true),
    ),

  async execute(interaction) {
    if (!(await ensureInVoice(interaction))) return;

    const query = interaction.options.getString("query", true);
    const guildId = interaction.guildId;
    const manager = interaction.client.lavalink;

    let player = manager.getPlayer(guildId);
    if (player && !(await ensureSameVoice(interaction, player))) return;

    if (!player) {
      player = manager.createPlayer({
        guildId,
        voiceChannelId: userVoiceChannelId(interaction),
        textChannelId: interaction.channelId,
        selfDeaf: true,
        volume: 80,
      });
    }

    if (!player.connected) await player.connect();

    await interaction.deferReply();

    let result;
    try {
      result = await player.search({ query }, interaction.user);
    } catch (err) {
      console.error("[/play] search error:", err);
      return interaction.editReply({ embeds: [errorEmbed("Audio service is down. Try again in a moment.")] });
    }

    if (!result || !result.tracks?.length) {
      return interaction.editReply({ embeds: [errorEmbed("Nothing found for that query.")] });
    }

    const isPlaylist = result.loadType === "playlist";

    if (isPlaylist) {
      await player.queue.add(result.tracks);
    } else {
      await player.queue.add(result.tracks[0]);
    }

    const wasIdle = !player.playing && !player.paused;
    if (wasIdle) await player.play();

    if (wasIdle && !isPlaylist) {
      // Now-playing card will appear via trackStart event; suppress duplicate confirmation.
      await interaction.deleteReply().catch(() => {});
      return;
    }

    if (isPlaylist) {
      const name = result.playlist?.name ?? "Playlist";
      return interaction.editReply({
        embeds: [infoEmbed(`➕ Queued **${result.tracks.length}** tracks from **${name}**.`)],
      });
    }

    const t = result.tracks[0].info;
    return interaction.editReply({
      embeds: [infoEmbed(`➕ Queued **${t.title}** (${formatDuration(t.duration)})`)],
    });
  },
};
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/commands/play.js
git commit -m "feat: /play command — search, queue, autoplay"
```

---

### Task 11: Track lifecycle events (post/edit/finalise the now-playing card)

**Files:**
- Modify: `src/lavalink.js`

- [ ] **Step 1: Add lifecycle handlers to `src/lavalink.js`**

Replace the entire body of `src/lavalink.js` with:
```js
import { LavalinkManager } from "lavalink-client";
import { buildNowPlayingMessage, buildQueueEndedMessage } from "./components/nowPlayingCard.js";
import { getGuildState, clearGuildState } from "./state.js";

async function getTextChannel(client, channelId) {
  if (!channelId) return null;
  try {
    return await client.channels.fetch(channelId);
  } catch {
    return null;
  }
}

async function postOrReplaceCard(client, player, track) {
  const state = getGuildState(player.guildId);
  const channel = await getTextChannel(client, player.textChannelId);
  if (!channel?.isTextBased()) return;

  const payload = buildNowPlayingMessage(track, player);

  // Try to edit the existing card if it's still the latest message we can find.
  if (state.nowPlayingMessageId && state.nowPlayingChannelId === channel.id) {
    try {
      const existing = await channel.messages.fetch(state.nowPlayingMessageId);
      await existing.edit(payload);
      return;
    } catch {
      // Message was deleted or the channel changed; fall through to repost.
    }
  }

  const msg = await channel.send(payload);
  state.nowPlayingMessageId = msg.id;
  state.nowPlayingChannelId = channel.id;
}

async function finaliseCard(client, player) {
  const state = getGuildState(player.guildId);
  if (!state.nowPlayingMessageId || !state.nowPlayingChannelId) return;
  const channel = await getTextChannel(client, state.nowPlayingChannelId);
  if (!channel?.isTextBased()) return;
  try {
    const msg = await channel.messages.fetch(state.nowPlayingMessageId);
    await msg.edit(buildQueueEndedMessage());
  } catch {
    // Card already gone — nothing to do.
  }
  state.nowPlayingMessageId = null;
  state.nowPlayingChannelId = null;
}

export function createLavalink(client) {
  const manager = new LavalinkManager({
    nodes: [{
      id: "main",
      host: process.env.LAVALINK_HOST || "lavalink",
      port: Number(process.env.LAVALINK_PORT || 2333),
      authorization: process.env.LAVALINK_PASSWORD || "changeme",
      secure: false,
    }],
    sendToShard: (guildId, payload) =>
      client.guilds.cache.get(guildId)?.shard?.send(payload),
    client: {
      id: process.env.DISCORD_CLIENT_ID,
      username: "MusicBot",
    },
    autoSkip: true,
    playerOptions: {
      defaultSearchPlatform: "ytsearch",
      onDisconnect: { autoReconnect: true, destroyPlayer: false },
      onEmptyQueue: { destroyAfterMs: 30_000 },
    },
  });

  manager.nodeManager.on("connect", (node) =>
    console.log(`[lavalink] Node "${node.id}" connected`)
  );
  manager.nodeManager.on("error", (node, err) =>
    console.error(`[lavalink] Node "${node.id}" error:`, err.message)
  );
  manager.nodeManager.on("disconnect", (node, reason) =>
    console.warn(`[lavalink] Node "${node.id}" disconnected:`, reason)
  );

  manager.on("trackStart", (player, track) => {
    postOrReplaceCard(client, player, track).catch((err) =>
      console.error("[lavalink] postOrReplaceCard:", err)
    );
  });

  manager.on("queueEnd", (player) => {
    finaliseCard(client, player).catch((err) =>
      console.error("[lavalink] finaliseCard:", err)
    );
  });

  manager.on("playerDestroy", (player) => {
    clearGuildState(player.guildId);
  });

  client.on("raw", (d) => manager.sendRawData(d));
  client.once("ready", () =>
    manager.init({ id: client.user.id, username: client.user.username })
  );

  return manager;
}
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/lavalink.js
git commit -m "feat: post/edit/finalise now-playing card on track events"
```

---

### Task 12: Global slash command registration script

**Files:**
- Create: `src/deploy-commands.js`

- [ ] **Step 1: Create `src/deploy-commands.js`**

Create `src/deploy-commands.js`:
```js
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
```

- [ ] **Step 2: Register the (so far, single) command**

Run from the project root, on the host (not inside the container):
```bash
npm run deploy
```
Expected:
- `[deploy] Registering 1 global commands...`
- `[deploy] Done. Discord returned 1 commands.`

- [ ] **Step 3: Smoke-test `/play` in Discord**

In a test Discord server where the bot is installed:
1. Join a voice channel.
2. Run `/play never gonna give you up`. (If `/play` doesn't autocomplete yet, wait a few minutes for global propagation, or re-deploy as a guild command for instant — see README later.)
3. Expected: the bot joins the voice channel, starts playing audio, and posts the now-playing card with 4 buttons.
4. Run `/play darude sandstorm` again — expect ephemeral "➕ Queued **Darude — Sandstorm** (3:45)" or similar.
5. The card stays on the first track until it ends.

Also tail logs in another terminal:
```bash
docker compose logs -f bot
```
Expected log lines on each play: no errors. On track transition, no "TypeError" / "Cannot read property".

- [ ] **Step 4: Commit**

Run:
```bash
git add src/deploy-commands.js
git commit -m "feat: global slash command registration script"
```

---

## Phase 4 — Button handlers

### Task 13: Pause/Resume button

**Files:**
- Create: `src/buttons/playPause.js`
- Modify: `src/lavalink.js` (refresh card on pause/resume)

- [ ] **Step 1: Create `src/buttons/playPause.js`**

Create `src/buttons/playPause.js`:
```js
import { ensureSameVoice } from "../util/permissions.js";
import { buildNowPlayingRow } from "../components/nowPlayingCard.js";

export default {
  customId: "np:playpause",
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) {
      return interaction.reply({ content: "Nothing is playing.", ephemeral: true });
    }
    if (!(await ensureSameVoice(interaction, player))) return;

    if (player.paused) await player.resume();
    else await player.pause();

    // Re-render the row in place (embed unchanged).
    await interaction.update({ components: [buildNowPlayingRow(player)] });
  },
};
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/buttons/playPause.js
git commit -m "feat: pause/resume button toggles label and refreshes card"
```

---

### Task 14: Skip button

**Files:**
- Create: `src/buttons/skip.js`

- [ ] **Step 1: Create `src/buttons/skip.js`**

Create `src/buttons/skip.js`:
```js
import { ensureSameVoice } from "../util/permissions.js";

export default {
  customId: "np:skip",
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player || !player.playing) {
      return interaction.reply({ content: "Nothing is playing.", ephemeral: true });
    }
    if (!(await ensureSameVoice(interaction, player))) return;

    await interaction.deferUpdate();
    await player.skip();
    // trackStart event will edit the card to the new track; queueEnd will finalise if nothing follows.
  },
};
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/buttons/skip.js
git commit -m "feat: skip button advances the queue"
```

---

### Task 15: Stop button

**Files:**
- Create: `src/buttons/stop.js`

- [ ] **Step 1: Create `src/buttons/stop.js`**

Create `src/buttons/stop.js`:
```js
import { ensureSameVoice } from "../util/permissions.js";
import { buildQueueEndedMessage } from "../components/nowPlayingCard.js";

export default {
  customId: "np:stop",
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) {
      return interaction.reply({ content: "Nothing is playing.", ephemeral: true });
    }
    if (!(await ensureSameVoice(interaction, player))) return;

    await interaction.update(buildQueueEndedMessage());
    player.queue.tracks.length = 0;
    await player.destroy("user pressed stop");
  },
};
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/buttons/stop.js
git commit -m "feat: stop button clears queue and disconnects"
```

---

### Task 16: Shuffle button

**Files:**
- Create: `src/buttons/shuffle.js`

- [ ] **Step 1: Create `src/buttons/shuffle.js`**

Create `src/buttons/shuffle.js`:
```js
import { ensureSameVoice } from "../util/permissions.js";
import { infoEmbed } from "../util/embeds.js";

export default {
  customId: "np:shuffle",
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) {
      return interaction.reply({ content: "Nothing is playing.", ephemeral: true });
    }
    if (!(await ensureSameVoice(interaction, player))) return;

    const upcoming = player.queue.tracks;
    if (upcoming.length < 2) {
      return interaction.reply({
        embeds: [infoEmbed("Nothing to shuffle — less than 2 tracks queued.")],
        ephemeral: true,
      });
    }

    await player.queue.shuffle();
    await interaction.reply({
      embeds: [infoEmbed(`🔀 Shuffled ${upcoming.length} upcoming tracks.`)],
      ephemeral: true,
    });
  },
};
```

- [ ] **Step 2: Verify all four buttons end-to-end**

Rebuild and start:
```bash
docker compose up -d --build bot
```

In Discord:
1. `/play <something long>` — wait for now-playing card.
2. `/play <something else>` then `/play <a third>` — queue 2 more.
3. Press ⏸ Pause — label flips to ▶ Resume; audio stops; press again to resume.
4. Press ⏭ Skip — card updates to track 2.
5. Press 🔀 Shuffle — ephemeral confirmation; remaining queue order changes (verify with `/queue` once that command exists in Task 19).
6. Press ⏹ Stop — card becomes "Queue ended"; bot leaves voice.
7. From a different voice channel: press any button — ephemeral "You need to be in the same voice channel as the bot."

If anything misbehaves, tail logs and fix before committing:
```bash
docker compose logs -f bot
```

- [ ] **Step 3: Commit**

Run:
```bash
git add src/buttons/shuffle.js
git commit -m "feat: shuffle button randomises remaining queue"
```

---

## Phase 5 — Remaining slash commands

### Task 17: `/pause` and `/resume`

**Files:**
- Create: `src/commands/pause.js`
- Create: `src/commands/resume.js`

- [ ] **Step 1: Create `src/commands/pause.js`**

Create `src/commands/pause.js`:
```js
import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { ensureSameVoice } from "../util/permissions.js";
import { errorEmbed, successEmbed } from "../util/embeds.js";

export default {
  data: new SlashCommandBuilder().setName("pause").setDescription("Pause the current track."),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player?.playing) {
      return interaction.reply({ embeds: [errorEmbed("Nothing is playing.")], flags: MessageFlags.Ephemeral });
    }
    if (!(await ensureSameVoice(interaction, player))) return;
    if (player.paused) {
      return interaction.reply({ embeds: [errorEmbed("Already paused.")], flags: MessageFlags.Ephemeral });
    }
    await player.pause();
    await interaction.reply({ embeds: [successEmbed("Paused.")], flags: MessageFlags.Ephemeral });
  },
};
```

- [ ] **Step 2: Create `src/commands/resume.js`**

Create `src/commands/resume.js`:
```js
import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { ensureSameVoice } from "../util/permissions.js";
import { errorEmbed, successEmbed } from "../util/embeds.js";

export default {
  data: new SlashCommandBuilder().setName("resume").setDescription("Resume the paused track."),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) {
      return interaction.reply({ embeds: [errorEmbed("Nothing to resume.")], flags: MessageFlags.Ephemeral });
    }
    if (!(await ensureSameVoice(interaction, player))) return;
    if (!player.paused) {
      return interaction.reply({ embeds: [errorEmbed("Already playing.")], flags: MessageFlags.Ephemeral });
    }
    await player.resume();
    await interaction.reply({ embeds: [successEmbed("Resumed.")], flags: MessageFlags.Ephemeral });
  },
};
```

- [ ] **Step 3: Commit**

Run:
```bash
git add src/commands/pause.js src/commands/resume.js
git commit -m "feat: /pause and /resume commands"
```

---

### Task 18: `/skip`, `/stop`, `/disconnect`, `/shuffle`

**Files:**
- Create: `src/commands/skip.js`
- Create: `src/commands/stop.js`
- Create: `src/commands/disconnect.js`
- Create: `src/commands/shuffle.js`

- [ ] **Step 1: Create `src/commands/skip.js`**

Create `src/commands/skip.js`:
```js
import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { ensureSameVoice } from "../util/permissions.js";
import { errorEmbed, successEmbed } from "../util/embeds.js";

export default {
  data: new SlashCommandBuilder().setName("skip").setDescription("Skip to the next track."),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player?.playing) {
      return interaction.reply({ embeds: [errorEmbed("Nothing is playing.")], flags: MessageFlags.Ephemeral });
    }
    if (!(await ensureSameVoice(interaction, player))) return;
    await player.skip();
    await interaction.reply({ embeds: [successEmbed("⏭ Skipped.")], flags: MessageFlags.Ephemeral });
  },
};
```

- [ ] **Step 2: Create `src/commands/stop.js`**

Create `src/commands/stop.js`:
```js
import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { ensureSameVoice } from "../util/permissions.js";
import { errorEmbed, successEmbed } from "../util/embeds.js";

export default {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Clear the queue and disconnect."),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) {
      return interaction.reply({ embeds: [errorEmbed("Not connected.")], flags: MessageFlags.Ephemeral });
    }
    if (!(await ensureSameVoice(interaction, player))) return;
    player.queue.tracks.length = 0;
    await player.destroy("user used /stop");
    await interaction.reply({ embeds: [successEmbed("⏹ Stopped and disconnected.")], flags: MessageFlags.Ephemeral });
  },
};
```

- [ ] **Step 3: Create `src/commands/disconnect.js`**

Create `src/commands/disconnect.js`:
```js
import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { ensureSameVoice } from "../util/permissions.js";
import { errorEmbed, successEmbed } from "../util/embeds.js";

export default {
  data: new SlashCommandBuilder()
    .setName("disconnect")
    .setDescription("Leave the voice channel, preserving the queue in memory."),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) {
      return interaction.reply({ embeds: [errorEmbed("Not connected.")], flags: MessageFlags.Ephemeral });
    }
    if (!(await ensureSameVoice(interaction, player))) return;
    await player.disconnect();
    // Player object stays alive; running /play again will re-connect and continue the queue.
    await interaction.reply({ embeds: [successEmbed("👋 Left the voice channel. Queue preserved.")], flags: MessageFlags.Ephemeral });
  },
};
```

- [ ] **Step 4: Create `src/commands/shuffle.js`**

Create `src/commands/shuffle.js`:
```js
import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { ensureSameVoice } from "../util/permissions.js";
import { errorEmbed, successEmbed } from "../util/embeds.js";

export default {
  data: new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Shuffle the remaining queue."),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) {
      return interaction.reply({ embeds: [errorEmbed("Not connected.")], flags: MessageFlags.Ephemeral });
    }
    if (!(await ensureSameVoice(interaction, player))) return;
    const n = player.queue.tracks.length;
    if (n < 2) {
      return interaction.reply({
        embeds: [errorEmbed("Need at least 2 queued tracks to shuffle.")],
        flags: MessageFlags.Ephemeral,
      });
    }
    await player.queue.shuffle();
    await interaction.reply({ embeds: [successEmbed(`🔀 Shuffled ${n} upcoming tracks.`)], flags: MessageFlags.Ephemeral });
  },
};
```

- [ ] **Step 5: Commit**

Run:
```bash
git add src/commands/skip.js src/commands/stop.js src/commands/disconnect.js src/commands/shuffle.js
git commit -m "feat: /skip, /stop, /disconnect, /shuffle commands"
```

---

### Task 19: `/queue` command with pagination

**Files:**
- Create: `src/commands/queue.js`

- [ ] **Step 1: Create `src/commands/queue.js`**

Create `src/commands/queue.js`:
```js
import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import { COLORS, errorEmbed } from "../util/embeds.js";
import { formatDuration } from "../util/formatDuration.js";

const PAGE_SIZE = 10;

export default {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the upcoming tracks.")
    .addIntegerOption((opt) =>
      opt.setName("page").setDescription("Page number (default 1)").setMinValue(1),
    ),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) {
      return interaction.reply({ embeds: [errorEmbed("Nothing in the queue.")], flags: MessageFlags.Ephemeral });
    }

    const upcoming = player.queue.tracks;
    const current = player.queue.current;
    if (upcoming.length === 0 && !current) {
      return interaction.reply({ embeds: [errorEmbed("Nothing in the queue.")], flags: MessageFlags.Ephemeral });
    }

    const requestedPage = interaction.options.getInteger("page") ?? 1;
    const totalPages = Math.max(1, Math.ceil(upcoming.length / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const slice = upcoming.slice(start, start + PAGE_SIZE);

    const lines = slice.map((t, i) => {
      const num = start + i + 1;
      const title = t.info.title || "Unknown";
      const dur = t.info.isStream ? "LIVE" : formatDuration(t.info.duration);
      return `**${num}.** [${title}](${t.info.uri}) — \`${dur}\``;
    });

    const embed = new EmbedBuilder()
      .setColor(COLORS.brand)
      .setTitle(`🎵 Queue — page ${page}/${totalPages}`)
      .setDescription(lines.length ? lines.join("\n") : "_No upcoming tracks._");

    if (current) {
      embed.addFields({
        name: "▶ Now playing",
        value: `[${current.info.title}](${current.info.uri}) — \`${current.info.isStream ? "LIVE" : formatDuration(current.info.duration)}\``,
      });
    }

    embed.setFooter({ text: `${upcoming.length} track(s) queued` });

    await interaction.reply({ embeds: [embed] });
  },
};
```

- [ ] **Step 2: Commit**

Run:
```bash
git add src/commands/queue.js
git commit -m "feat: /queue with pagination"
```

---

### Task 20: `/nowplaying` command

**Files:**
- Create: `src/commands/nowplaying.js`

- [ ] **Step 1: Create `src/commands/nowplaying.js`**

Create `src/commands/nowplaying.js`:
```js
import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { buildNowPlayingMessage } from "../components/nowPlayingCard.js";
import { errorEmbed } from "../util/embeds.js";
import { getGuildState } from "../state.js";

export default {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Re-post the now-playing card at the bottom of the channel."),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    const current = player?.queue?.current;
    if (!player?.playing || !current) {
      return interaction.reply({ embeds: [errorEmbed("Nothing is playing.")], flags: MessageFlags.Ephemeral });
    }

    const state = getGuildState(player.guildId);

    // Delete the old card (if any).
    if (state.nowPlayingMessageId && state.nowPlayingChannelId) {
      try {
        const oldChannel = await interaction.client.channels.fetch(state.nowPlayingChannelId);
        const oldMsg = await oldChannel.messages.fetch(state.nowPlayingMessageId);
        await oldMsg.delete();
      } catch {
        // Already gone — no-op.
      }
    }

    const payload = buildNowPlayingMessage(current, player);
    await interaction.reply(payload);
    const sent = await interaction.fetchReply();

    state.nowPlayingMessageId = sent.id;
    state.nowPlayingChannelId = interaction.channelId;
    // Subsequent trackStart events will update this new card in place.
    player.textChannelId = interaction.channelId;
  },
};
```

- [ ] **Step 2: Re-deploy commands and smoke-test**

Run:
```bash
npm run deploy
docker compose up -d --build bot
```
Expected deploy output: `Discord returned 9 commands.`

In Discord, exercise every command at least once:
- `/play <query>` (idle case → card appears)
- `/play <query>` (queue case → ephemeral confirmation)
- `/pause`, `/resume`
- `/skip`
- `/shuffle`
- `/queue` (with `page: 2` if you have enough tracks)
- `/nowplaying`
- `/disconnect` → then `/play` again → bot resumes the same queue
- `/stop`

- [ ] **Step 3: Commit**

Run:
```bash
git add src/commands/nowplaying.js
git commit -m "feat: /nowplaying re-posts the card at the bottom of the channel"
```

---

## Phase 6 — Resilience & docs

### Task 21: Auto-disconnect on empty voice channel

**Files:**
- Create: `src/events/voiceStateUpdate.js`

- [ ] **Step 1: Create `src/events/voiceStateUpdate.js`**

Create `src/events/voiceStateUpdate.js`:
```js
import { Events } from "discord.js";
import { getGuildState } from "../state.js";

const EMPTY_TIMEOUT_MS = 60_000;

function humansInChannel(channel) {
  if (!channel) return 0;
  return channel.members.filter((m) => !m.user.bot).size;
}

export default {
  name: Events.VoiceStateUpdate,
  execute(oldState, newState) {
    const client = newState.client;
    const guildId = newState.guild.id;
    const manager = client.lavalink;
    const player = manager.getPlayer(guildId);
    if (!player?.voiceChannelId) return;

    const botChannelId = player.voiceChannelId;
    const involvesBotChannel =
      oldState.channelId === botChannelId || newState.channelId === botChannelId;
    if (!involvesBotChannel) return;

    const botChannel = newState.guild.channels.cache.get(botChannelId);
    const remaining = humansInChannel(botChannel);
    const state = getGuildState(guildId);

    if (remaining === 0) {
      if (state.leaveTimer) return; // already scheduled
      state.leaveTimer = setTimeout(async () => {
        state.leaveTimer = null;
        const p = manager.getPlayer(guildId);
        if (!p) return;
        const ch = newState.guild.channels.cache.get(p.voiceChannelId);
        if (humansInChannel(ch) === 0) {
          console.log(`[voice] auto-disconnecting from guild ${guildId} (channel empty for ${EMPTY_TIMEOUT_MS}ms)`);
          p.queue.tracks.length = 0;
          await p.destroy("voice channel empty");
        }
      }, EMPTY_TIMEOUT_MS);
    } else if (state.leaveTimer) {
      clearTimeout(state.leaveTimer);
      state.leaveTimer = null;
    }
  },
};
```

- [ ] **Step 2: Smoke-test**

Restart the bot:
```bash
docker compose up -d --build bot
```

In Discord:
1. `/play <something>` to make the bot join.
2. Leave the voice channel yourself.
3. Wait ~60 seconds.
4. Expected: bot disconnects on its own; the now-playing card finalises to "Queue ended". Logs show `[voice] auto-disconnecting from guild ...`.
5. Repeat: `/play`, leave, rejoin within 30 seconds. Bot should NOT disconnect.

- [ ] **Step 3: Commit**

Run:
```bash
git add src/events/voiceStateUpdate.js
git commit -m "feat: auto-disconnect after 60s in an empty voice channel"
```

---

### Task 22: README with setup and operations

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

Create `README.md`:
````markdown
# MusicBot

A self-hosted Discord music bot. Slash commands only. YouTube, Spotify (via YouTube resolution), SoundCloud, Apple Music, Deezer, Tidal, Bandcamp, Twitch, Vimeo, and direct HTTP audio links. SponsorBlock auto-skips sponsor segments on YouTube tracks.

## Stack

- Node.js 20 + `discord.js` v14
- `lavalink-client` v2
- Lavalink v4 with LavaSrc, YouTube, and SponsorBlock plugins
- Docker Compose (one command up)

## Prerequisites

- Docker Engine 24+ with Compose v2
- A Discord application: https://discord.com/developers/applications
  - Create a bot, copy the **Token** and the **Application ID**
  - OAuth2 → URL Generator → scopes: `bot`, `applications.commands`
  - Bot permissions: View Channels, Send Messages, Embed Links, Connect, Speak, Use Voice Activity
  - Open the generated URL to invite the bot to your server
- (Optional) Spotify developer credentials: https://developer.spotify.com/dashboard

## Setup

```bash
git clone <this repo>
cd MusicBot
cp .env.example .env
# Edit .env and fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, LAVALINK_PASSWORD,
# and optionally SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET.

docker compose up -d --build
docker compose logs -f
```

Wait for:
- `Loaded plugin youtube-plugin`, `lavasrc-plugin`, `sponsorblock-plugin`
- `Lavalink is ready to accept connections`
- `[lavalink] Node "main" connected`
- `[discord] Logged in as <BotName>#0000`

## Registering slash commands

Slash commands are registered globally and can take up to an hour to appear in all servers after the first deploy.

From your host (not inside the container):

```bash
npm install            # only needed once, for the deploy script's dependencies
npm run deploy
```

Re-run `npm run deploy` whenever you change command definitions.

### Faster iteration during development

If you want commands to appear instantly in one specific server, pass that guild's id to a temporary tweak of `src/deploy-commands.js` (use `Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)` instead of `Routes.applicationCommands(CLIENT_ID)`). Revert before shipping.

## Commands

| Command | Description |
|---|---|
| `/play <query>` | Play a URL or search query |
| `/pause` | Pause the current track |
| `/resume` | Resume the paused track |
| `/skip` | Skip to the next track |
| `/stop` | Clear the queue and disconnect |
| `/queue [page]` | List upcoming tracks (10 per page) |
| `/nowplaying` | Re-post the now-playing card |
| `/disconnect` | Leave voice, keep the queue in memory |
| `/shuffle` | Shuffle the remaining queue |

Plus a 4-button row on the now-playing card: ⏯ Pause/Resume, ⏭ Skip, ⏹ Stop, 🔀 Shuffle. Only users in the same voice channel as the bot can press them.

## Operations

```bash
docker compose logs -f bot          # tail bot logs
docker compose logs -f lavalink     # tail lavalink logs
docker compose restart bot          # apply config changes without rebuilding
docker compose up -d --build bot    # rebuild after code changes
docker compose down                 # stop everything
```

## Known limitations (v1)

- Queues are in-memory; a bot restart loses them.
- No per-guild settings, no saved user playlists, no audio filters.
- Old now-playing cards from previous bot sessions are inert — run `/play` again to spawn a fresh one.
- Spotify Premium-only and podcast tracks won't resolve (LavaSrc falls back to YouTube search, which won't have them).

## Architecture

```
Discord Gateway ──ws──> bot container ──tcp──> lavalink container
                                    └─ voice UDP via discord.js/voice ─┘
                                                                       ▲
                                                                       │
                                        Lavalink fetches audio from YT/SC/Spotify-via-YT
```

The bot makes outbound-only connections. No port forwarding or public IP required on the host.
````

- [ ] **Step 2: Commit**

Run:
```bash
git add README.md
git commit -m "docs: README with setup, commands, and operations"
```

---

## Phase 7 — Final verification

### Task 23: Full end-to-end smoke

**Files:** none.

- [ ] **Step 1: Fresh start**

```bash
docker compose down
docker compose up -d --build
docker compose logs -f
```

Confirm all the startup log lines from Task 22's README. Stop tailing with Ctrl-C.

- [ ] **Step 2: Run every command at least once**

In Discord, with the bot installed and you in a voice channel:

| Action | Expected |
|---|---|
| `/play https://www.youtube.com/watch?v=dQw4w9WgXcQ` | Bot joins; now-playing card appears with 4 buttons; audio plays |
| `/play <spotify track URL>` | Track resolves via LavaSrc → YouTube; queued or playing |
| `/play <soundcloud URL>` | SoundCloud track plays |
| `/play <free text search>` | First search hit plays |
| `/pause`, `/resume` | Audio pauses and resumes; ephemeral confirmations |
| `/skip` | Card updates to next track |
| `/queue` | Embed lists upcoming tracks (or "No upcoming tracks") |
| `/queue page:2` | Second page if applicable, else clamps to last page |
| `/nowplaying` | Old card vanishes; new card appears at bottom |
| `/shuffle` | Ephemeral confirmation; queue order changes |
| Press ⏸ button | Card updates: button becomes ▶ Resume; audio pauses |
| Press ⏭ button | Next track plays; card updates |
| Press 🔀 button | Ephemeral confirmation |
| Press ⏹ button | Card → "Queue ended"; bot leaves voice |
| `/disconnect` (mid-queue) | Bot leaves; queue preserved |
| `/play <new track>` after `/disconnect` | Bot rejoins; resumes from where queue was |
| `/stop` | Queue cleared; bot disconnects |
| Leave voice, wait 60s | Bot auto-disconnects; log line confirms |
| Button press from different voice channel | Ephemeral "same voice channel" error; no state change |

- [ ] **Step 3: Final commit / tag**

If any fixes were needed during testing, commit them with descriptive messages. Then:

```bash
git tag v0.1.0
git log --oneline
```
Expected: a clean history of feat: / docs: commits, ending at `v0.1.0`.

---

## Notes for the executing engineer

- **The `lavalink-client` API may have shifted** since this plan was written. If `player.queue.shuffle()`, `player.search()`, or event names like `trackStart` / `queueEnd` are missing or renamed, check the current docs at https://lavalink-client.tomato6966.com/ and adapt. Method names in this plan match v2.5.x.
- **Lavalink plugin versions** in `lavalink/application.yml` will go stale. If Lavalink fails to download a listed plugin version, bump to the latest from the plugin's GitHub releases.
- **YouTube extraction breaks every few months.** When `/play` starts returning "Nothing found" for valid YouTube URLs and Lavalink logs show extraction errors, bump `dev.lavalink.youtube:youtube-plugin` in `application.yml` to the latest release and `docker compose restart lavalink`.
- **Do not skip the verification steps.** Several tasks depend on side effects (Lavalink plugin downloads, slash command registration, etc.) that fail silently if mis-configured. Catching them at the step where they break is much cheaper than debugging at Task 23.

---

## Spec coverage map

| Spec requirement | Implemented in |
|---|---|
| Node.js 20 + discord.js v14 | Task 1, Task 5 |
| Lavalink v4 + LavaSrc + SponsorBlock | Task 2 |
| Docker Compose (bot + lavalink) | Tasks 3, 4 |
| In-memory state only | Task 5 (`src/state.js`) |
| 9 slash commands | Tasks 10, 17, 18, 19, 20 |
| Now-playing card with 4 buttons | Tasks 8, 11, 13–16 |
| Same-voice-channel guard | Task 7 (`permissions.js`), used in all command/button files |
| `/stop` clears queue + disconnects | Task 18 |
| `/disconnect` preserves queue | Task 18 |
| Card edits in place on track transitions | Task 11 |
| `/nowplaying` re-posts at bottom | Task 20 |
| Auto-disconnect after 60s empty | Task 21 |
| Global error handling (unhandledRejection, command try/catch) | Task 5 (`src/index.js`), Task 9 (router) |
| Outbound-only networking | Task 4 (docker-compose, no published ports for the bot) |
| Smoke tests, no unit tests | Tasks 4 (Lavalink up), 12 (first command), 16 (buttons), 20 (all commands), 23 (full E2E) |
| README setup docs | Task 22 |
