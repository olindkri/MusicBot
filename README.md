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
- `YouTube source initialised with clients: ...`
- `Lavalink is ready to accept connections`
- `[lavalink] Node "main" connected`
- `[discord] Logged in as <BotName>#0000`

## Registering slash commands

Slash commands are registered globally and can take up to an hour to appear in all servers after the first deploy.

From your host:

```bash
docker compose exec bot node src/deploy-commands.js
```

Re-run that whenever you change command definitions.

### Faster iteration during development

For instant command updates in one specific server, deploy as guild commands (Discord propagates these in seconds):

```bash
docker compose exec -e GUILD_ID=<your-server-id> bot node --input-type=module -e "
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const dir = '/app/src/commands';
const payload = [];
for (const f of readdirSync(dir).filter(f => f.endsWith('.js'))) {
  const mod = (await import(pathToFileURL(join(dir, f)).href)).default;
  payload.push(mod.data.toJSON());
}
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const r = await rest.put(Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.GUILD_ID), { body: payload });
console.log('Deployed', r.length, 'guild commands');
"
```

Get the server id by right-clicking the server icon → Copy Server ID (requires Developer Mode in Discord Settings → Advanced).

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

Plus a 4-button row on the now-playing card: Pause/Resume, Skip, Stop, Shuffle. Only users in the same voice channel as the bot can press them.

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
- The YouTube source plugin and its required client list drift every few months as YouTube changes its player script — bump `dev.lavalink.youtube:youtube-plugin` in `lavalink/application.yml` to the latest release if `/play` starts failing.

## Architecture

```
Discord Gateway ──ws──> bot container ──tcp──> lavalink container
                                    └─ voice UDP via discord.js/voice ─┘
                                                                       ▲
                                                                       │
                                        Lavalink fetches audio from YT/SC/Spotify-via-YT
```

The bot makes outbound-only connections. No port forwarding or public IP required on the host.
