import { Events } from "discord.js";

export default {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`[discord] Logged in as ${client.user.tag} (id: ${client.user.id})`);
    console.log(`[discord] Serving ${client.guilds.cache.size} guild(s)`);
  },
};
