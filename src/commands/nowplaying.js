import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { buildNowPlayingMessage } from "../components/nowPlayingCard.js";
import { errorEmbed } from "../util/embeds.js";
import { getGuildState } from "../state.js";
import { scheduleDelete } from "../util/replies.js";

export default {
  data: new SlashCommandBuilder()
    .setName("nowplaying")
    .setDescription("Re-post the now-playing card at the bottom of the channel."),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    const current = player?.queue?.current;
    if (!player?.playing || !current) {
      await interaction.reply({ embeds: [errorEmbed("Nothing is playing.")], flags: MessageFlags.Ephemeral });
      scheduleDelete(interaction);
      return;
    }

    const state = getGuildState(player.guildId);

    if (state.nowPlayingMessageId && state.nowPlayingChannelId) {
      try {
        const oldChannel = await interaction.client.channels.fetch(state.nowPlayingChannelId);
        const oldMsg = await oldChannel.messages.fetch(state.nowPlayingMessageId);
        await oldMsg.delete();
      } catch {
        // Already gone.
      }
    }

    const payload = buildNowPlayingMessage(current, player);
    await interaction.reply(payload);
    const sent = await interaction.fetchReply();

    state.nowPlayingMessageId = sent.id;
    state.nowPlayingChannelId = interaction.channelId;
    player.textChannelId = interaction.channelId;
  },
};
