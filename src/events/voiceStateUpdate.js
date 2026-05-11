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
