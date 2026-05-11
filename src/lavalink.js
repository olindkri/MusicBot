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
