import { LavalinkManager } from "lavalink-client";
import { buildNowPlayingMessage, buildNowPlayingRow } from "./components/nowPlayingCard.js";
import { getGuildState, clearGuildState } from "./state.js";
import { errorEmbed } from "./util/embeds.js";
import { announce } from "./util/announce.js";

async function getTextChannel(client, channelId) {
  if (!channelId) return null;
  try {
    return await client.channels.fetch(channelId);
  } catch {
    return null;
  }
}

async function postOrReplaceCard(client, player, track) {
  // Intro jingles are local files — never decorate them with a card.
  if (track?.info?.sourceName === "local") return;
  const state = getGuildState(player.guildId);
  const channel = await getTextChannel(client, player.textChannelId);
  if (!channel?.isTextBased()) return;

  const payload = buildNowPlayingMessage(track, player);

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

async function deleteNowPlayingCard(client, guildId) {
  const state = getGuildState(guildId);
  if (!state.nowPlayingMessageId || !state.nowPlayingChannelId) return;
  const channelId = state.nowPlayingChannelId;
  const messageId = state.nowPlayingMessageId;
  state.nowPlayingMessageId = null;
  state.nowPlayingChannelId = null;
  try {
    const channel = await getTextChannel(client, channelId);
    if (!channel?.isTextBased()) return;
    await channel.messages.delete(messageId);
  } catch {
    // Already gone.
  }
}

// Queueing more tracks mid-song can make Shuffle relevant, but nothing repaints
// the card until the next trackStart. Refresh just the buttons in that window.
export async function refreshNowPlayingRow(client, player) {
  const state = getGuildState(player.guildId);
  if (!state.nowPlayingMessageId || !state.nowPlayingChannelId) return;
  try {
    const channel = await getTextChannel(client, state.nowPlayingChannelId);
    if (!channel?.isTextBased()) return;
    const msg = await channel.messages.fetch(state.nowPlayingMessageId);
    await msg.edit({ components: [buildNowPlayingRow(player)] });
  } catch {
    // Card is gone or uneditable; the next trackStart reposts it.
  }
}

export function createLavalink(client) {
  const manager = new LavalinkManager({
    nodes: [{
      id: "main",
      host: process.env.LAVALINK_HOST || "lavalink",
      port: Number(process.env.LAVALINK_PORT || 2333),
      authorization: process.env.LAVALINK_PASSWORD || "changeme",
      secure: false,
      retryAmount: 30,
      retryDelay: 10_000,
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
      onDisconnect: { autoReconnect: false, destroyPlayer: true },
      onEmptyQueue: { destroyAfterMs: 30_000 },
    },
  });

  // A Lavalink restart drops the node for a second or two. Only tell the
  // server once an outage looks real, and only say we're back if we said
  // we were down.
  const OUTAGE_GRACE_MS = 15_000;
  let outageTimer = null;
  let outageAnnounced = false;

  function onNodeDown() {
    if (outageTimer || outageAnnounced) return;
    outageTimer = setTimeout(() => {
      outageTimer = null;
      outageAnnounced = true;
      announce(client, "audioDown").catch((err) =>
        console.error("[lavalink] audioDown announce failed:", err)
      );
    }, OUTAGE_GRACE_MS);
  }

  manager.nodeManager.on("connect", (node) => {
    console.log(`[lavalink] Node "${node.id}" connected`);
    if (outageTimer) {
      clearTimeout(outageTimer);
      outageTimer = null;
    }
    if (outageAnnounced) {
      outageAnnounced = false;
      announce(client, "back").catch((err) =>
        console.error("[lavalink] back announce failed:", err)
      );
    }
  });
  manager.nodeManager.on("error", (node, err) => {
    console.error(`[lavalink] Node "${node.id}" error:`, err.message);
    onNodeDown();
  });
  manager.nodeManager.on("disconnect", (node, reason) => {
    console.warn(`[lavalink] Node "${node.id}" disconnected:`, reason);
    onNodeDown();
  });

  manager.on("trackStart", (player, track) => {
    postOrReplaceCard(client, player, track).catch((err) =>
      console.error("[lavalink] postOrReplaceCard:", err)
    );
  });

  async function announceTrackFailure(player, track, detail) {
    const title = track?.info?.title ?? "Unknown track";
    console.error(`[lavalink] track failed: ${title} — ${detail}`);
    const channel = await getTextChannel(client, player.textChannelId);
    if (channel?.isTextBased()) {
      await channel
        .send({ embeds: [errorEmbed(`Couldn't play **${title}**. Skipping.`)] })
        .then((msg) => setTimeout(() => msg.delete().catch(() => {}), 8000))
        .catch(() => {});
    }
    // The track never started, so nothing advances the queue on its own.
    if (player.queue.tracks.length) await player.skip().catch(() => {});
  }

  manager.on("trackError", (player, track, payload) => {
    announceTrackFailure(player, track, payload?.exception?.message ?? "unknown error").catch(
      (err) => console.error("[lavalink] trackError handler:", err)
    );
  });

  manager.on("trackStuck", (player, track) => {
    announceTrackFailure(player, track, "stuck (no audio received)").catch((err) =>
      console.error("[lavalink] trackStuck handler:", err)
    );
  });

  manager.on("queueEnd", (player) => {
    deleteNowPlayingCard(client, player.guildId).catch((err) =>
      console.error("[lavalink] deleteNowPlayingCard (queueEnd):", err)
    );
  });

  manager.on("playerDestroy", async (player) => {
    await deleteNowPlayingCard(client, player.guildId).catch(() => {});
    clearGuildState(player.guildId);
  });

  client.on("raw", (d) => manager.sendRawData(d));
  client.once("ready", () =>
    manager.init({ id: client.user.id, username: client.user.username })
  );

  return manager;
}
