import { SlashCommandBuilder } from "discord.js";
import { buildNowPlayingMessage } from "../components/nowPlayingCard.js";
import { getGuildState } from "../state.js";
import { replyError } from "../util/replies.js";

export default {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Re-post the now-playing card at the bottom of the channel."),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    const current = player?.queue?.current;
    if (!player?.playing || !current) return replyError(interaction, "Nothing is playing.");

    const state = getGuildState(player.guildId);

    if (state.nowPlayingMessageId && state.nowPlayingChannelId) {
      const oldChannelId = state.nowPlayingChannelId;
      const oldMessageId = state.nowPlayingMessageId;
      state.nowPlayingMessageId = null;
      state.nowPlayingChannelId = null;
      try {
        const oldChannel = await interaction.client.channels.fetch(oldChannelId);
        await oldChannel.messages.delete(oldMessageId);
      } catch { /* already gone */ }
    }

    await interaction.reply(buildNowPlayingMessage(current, player));
    const sent = await interaction.fetchReply();
    state.nowPlayingMessageId = sent.id;
    state.nowPlayingChannelId = interaction.channelId;
    player.textChannelId = interaction.channelId;
  },
};
