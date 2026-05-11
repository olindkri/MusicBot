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

const QUEUE_ENDED_TTL_MS = 8_000;

async function finaliseCard(client, player) {
  const state = getGuildState(player.guildId);
  if (!state.nowPlayingMessageId || !state.nowPlayingChannelId) return;
  const channel = await getTextChannel(client, state.nowPlayingChannelId);
  const messageId = state.nowPlayingMessageId;
  state.nowPlayingMessageId = null;
  state.nowPlayingChannelId = null;
  if (!channel?.isTextBased()) return;
  let msg;
  try {
    msg = await channel.messages.fetch(messageId);
    await msg.edit(buildQueueEndedMessage());
  } catch {
    return; // Card already gone.
  }
  setTimeout(() => {
    msg.delete().catch(() => {});
  }, QUEUE_ENDED_TTL_MS);
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
