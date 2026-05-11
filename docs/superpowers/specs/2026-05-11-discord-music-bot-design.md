# Discord Music Bot — Design Spec

**Date:** 2026-05-11
**Status:** Approved, ready for implementation plan
**Owner:** oliver.l.kristiansen@hiof.no

## Goal

Self-hosted Discord music bot for personal use across one or more Discord servers, modelled on Hade's UX but without Hade's vote-for-YouTube gate. Runs from the user's local Linux machine; works on any server the bot is invited to via outbound Discord Gateway connection (no inbound networking required on the host).

## Non-goals (v1)

- Persistent queues across restarts
- Per-guild settings or role-based command gating
- Web dashboard
- Autoplay / radio mode
- Audio filters/effects (bassboost, nightcore, etc.)
- Lyrics
- Saved user playlists
- Unit test suite (integration smoke test only)

These are explicit deferrals, not forgotten requirements. Architecture should not preclude adding them later but must not pay implementation cost for them now.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 20 LTS | discord.js v14 target; modern ESM support |
| Discord lib | `discord.js` v14 | Largest ecosystem; first-class slash commands and components v2 |
| Voice/audio | Lavalink v4 (Java service) | Offloads audio to a dedicated process; standard for multi-source bots |
| Lavalink client | `lavalink-client` | Modern, TS-friendly, actively maintained, queue helpers built in |
| Source plugins | LavaSrc + SponsorBlock | YouTube/Spotify/SoundCloud/Apple/Deezer/Tidal/+ via one plugin; auto-skip sponsor segments |
| Hosting | Docker Compose, local Linux host | One-command up; trivially portable to a VPS later |
| State | In-memory only | Matches v1 non-goals; no DB or volume needed |

## Architecture

```
Discord Gateway ──ws──> bot container ──tcp──> lavalink container
                                    └─ voice UDP via discord.js/voice ─┘
                                                                       ▲
                                                                       │
                                        Lavalink fetches audio from YT/SC/Spotify-via-YT
```

- The **bot** maintains a persistent outbound WebSocket to the Discord Gateway. It receives slash-command and button interactions, maintains the per-guild Lavalink player state, and sends control messages to Lavalink.
- **Lavalink** runs as a separate service. It receives play/pause/seek/etc. commands over its REST + WebSocket API, fetches audio from configured sources, encodes to Opus, and forwards voice packets directly to Discord (via the voice UDP connection the bot established and handed off).
- **LavaSrc** is a Lavalink plugin that lets Lavalink resolve Spotify/Apple Music/Deezer/Tidal URLs by reading their public metadata and searching YouTube (or other supported source) for matching audio. Spotify's API does not permit third-party streaming; this is the standard workaround used by every multi-source Discord bot.
- **SponsorBlock** is a Lavalink plugin that auto-skips sponsor/intro/outro segments on YouTube tracks using the community-maintained SponsorBlock database.
- Both containers run on a private Docker bridge network. Only the bot makes outbound connections (to Discord). Lavalink is not exposed to the host network beyond what Docker Compose internal DNS provides.

## Components

```
src/
  index.js                          # Discord client bootstrap, login, event registration
  lavalink.js                       # NodeManager setup, voice update routing, player events
  deploy-commands.js                # One-shot script: register the 9 slash commands globally
  events/
    ready.js                        # Logs "logged in as ..." and "lavalink connected"
    interactionCreate.js            # Routes slash commands AND button interactions
    voiceStateUpdate.js             # Disconnects bot when last human leaves its voice channel
  commands/
    play.js                         # /play <query>
    pause.js                        # /pause
    resume.js                       # /resume
    skip.js                         # /skip
    stop.js                         # /stop (clears queue + disconnects)
    queue.js                        # /queue (paginated upcoming tracks)
    nowplaying.js                   # /nowplaying (re-renders the now-playing card)
    disconnect.js                   # /disconnect (leaves voice; preserves in-memory queue)
    shuffle.js                      # /shuffle (randomises remaining queue)
  components/
    nowPlayingCard.js               # Builds the embed + button row; exposes update(player, channel) helper
  buttons/
    playPause.js                    # ⏯ toggles based on player.paused
    skip.js                         # ⏭
    stop.js                         # ⏹
    shuffle.js                      # 🔀
  util/
    embeds.js                       # Shared embed styling helpers (colors, footer, thumbnails)
    permissions.js                  # ensureInVoice(interaction) / ensureSameVoice(interaction, player)
    formatDuration.js               # ms → "3:42" / "1:02:15"
```

Each file has one purpose, communicates through explicit imports, and can be reasoned about without reading the others. The `commands/` and `buttons/` directories are auto-loaded by glob in `index.js` so adding a new command means dropping a file in.

## Slash commands (9)

| Command | Options | Description |
|---|---|---|
| `/play` | `query` (string, required) | Searches and plays/queues a track. Accepts URLs (YT/SC/Spotify/etc.) or free-text search. |
| `/pause` | — | Pauses the current track. |
| `/resume` | — | Resumes a paused track. |
| `/skip` | — | Skips to the next track in the queue. |
| `/stop` | — | Clears the queue and disconnects. Destructive. |
| `/queue` | `page` (int, optional) | Lists upcoming tracks (10 per page). |
| `/nowplaying` | — | Re-renders the now-playing card at the bottom of the channel. |
| `/disconnect` | — | Leaves the voice channel but keeps the in-memory queue. Running `/play` afterwards rejoins and resumes from the queued tracks. |
| `/shuffle` | — | Shuffles the remaining queue. |

All commands require the invoking user to be in a voice channel. Music-control commands (everything except `/play` when bot is idle) additionally require the user to be in the *same* voice channel as the bot.

## Now-playing card

A persistent embed posted by the bot at the moment a track starts playing, carrying interactive controls.

**Embed contents:**
- Title (track name, clickable to source URL)
- Author / artist
- Thumbnail (track artwork from source)
- Duration + source platform (e.g. "3:42 · YouTube")
- Requested by (user mention)

**Button row (single ActionRow, 4 buttons):**
- ⏯ **Pause/Resume** — label and style toggle based on `player.paused`
- ⏭ **Skip**
- ⏹ **Stop**
- 🔀 **Shuffle**

**Lifecycle:**
1. `/play` starts a track from idle → bot posts new card → stores `messageId` on the player object.
2. On `trackEnd` → next track begins → bot edits the existing card in place to reflect the new track.
3. On `queueEnd` → bot edits the card to "Queue ended" state and removes the button row, then disconnects.
4. On `/stop` or `/disconnect` → bot deletes the card (or edits to "Stopped") and disconnects.
5. `/nowplaying` deletes the existing card and posts a fresh one at the bottom of the channel (useful when the card has scrolled off).

**Button permission rule:** only users in the same voice channel as the bot may press. Wrong-channel presses get an ephemeral "Join the voice channel first" reply via `interaction.reply({ ephemeral: true })`. No state mutation.

**Bot restart behavior:** old cards become inert (their button handlers are no longer in memory; pressing them yields Discord's default "This interaction failed" toast). User runs `/play` again to spawn a fresh card. Acceptable for v1; would require persistent state to solve, which is a non-goal.

## Data flow: `/play <query>`

1. User runs `/play never gonna give you up` while in a voice channel.
2. `interactionCreate` event fires → routed to `commands/play.js`.
3. `ensureInVoice(interaction)` guard: if user not in voice → ephemeral error.
4. Get-or-create player for guild via `client.lavalink.players.create({...})`.
5. If bot not connected: connect to user's voice channel.
6. `player.search({ query }, interaction.user)` → returns `SearchResult` (track, playlist, or empty).
7. Add result(s) to `player.queue`.
8. If `player.playing === false` → `player.play()`. The `trackStart` event handler will post the now-playing card.
9. Reply to interaction:
   - If track started immediately: do not post a "Queued" message (the now-playing card serves as confirmation).
   - If track was added to an existing queue: ephemeral "➕ Queued: [title]" reply (no buttons).
10. Errors (no results, Lavalink error, network) → ephemeral error reply with the user-facing message.

## Error handling

| Condition | Behavior |
|---|---|
| User not in voice channel | Ephemeral reply: "Join a voice channel first." |
| User in different voice channel from bot | Ephemeral reply: "You need to be in the same voice channel as the bot." |
| No search results | Ephemeral reply: "Nothing found for that query." |
| Lavalink node unreachable | Log error; ephemeral reply: "Audio service is down. Try again in a moment." |
| Bot kicked from voice channel | Listen to `voiceStateUpdate`; destroy player gracefully; no error toast. |
| Last human leaves bot's voice channel | Auto-disconnect after 60 seconds of empty channel. |
| Unhandled promise rejection | Log to stderr with full stack; process does NOT exit. |
| Slash command throws | Caught in `interactionCreate` router; ephemeral reply: "Something went wrong. The error has been logged." |

## Hosting

**`docker-compose.yml`** defines two services:
- `lavalink` — image `ghcr.io/lavalink-devs/lavalink:4`, mounts `./lavalink/application.yml` and `./lavalink/plugins/`, exposes port `2333` on the internal Docker network only.
- `bot` — built from local `Dockerfile`, depends on `lavalink`, reads env from `.env`, restart policy `unless-stopped`.

**`.env`** (gitignored; `.env.example` checked in) contains:
- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `LAVALINK_PASSWORD`
- `SPOTIFY_CLIENT_ID` (optional — enables richer Spotify metadata via LavaSrc)
- `SPOTIFY_CLIENT_SECRET` (optional)

**`lavalink/application.yml`** declares the LavaSrc and SponsorBlock plugins by Maven coordinates and configures their source toggles. Lavalink downloads plugins on first run.

**Operational:** `docker compose up -d` to start, `docker compose logs -f bot` to tail. Updates: `git pull && docker compose build bot && docker compose up -d`.

## Testing

No unit test suite for v1. The bot is thin glue over `lavalink-client` and `discord.js`; the value is in integration, not isolated logic.

**Smoke test on every change:**
1. `docker compose up` → bot logs "Lavalink node connected" within 10s.
2. Bot logs "Logged in as <name>" within 5s after Lavalink connects.
3. In a test Discord server: run each of the 9 slash commands at least once.
4. Press each of the 4 buttons on the now-playing card.
5. Verify same-voice-channel guard rejects from outside the bot's voice channel.

A future v2 could introduce a real test suite, likely around the queue/player-state helpers if they grow.

## Open questions

None outstanding for v1.

## Future extensions (not in v1)

Listed to confirm the v1 architecture won't block them, not as a roadmap:
- Persistent queue/now-playing state → add Redis or SQLite, store `messageId` and `tracks` per guild.
- Web dashboard → add Express service in the same compose file, share a state package with the bot.
- Audio filters → expose Lavalink's filter API behind a `/filter` command.
- Per-guild settings → add SQLite, configure default volume / allowed-roles per guild.
