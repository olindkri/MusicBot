import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { ensureSameVoice } from "../util/permissions.js";
import { replyError } from "../util/replies.js";

export default {
  data: new SlashCommandBuilder()
    .setName("disconnect")
    .setDescription("Leave the voice channel and clear the queue."),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return replyError(interaction, "Not connected.");
    if (!(await ensureSameVoice(interaction, player))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    player.queue.tracks.length = 0;
    await player.destroy("user used /disconnect");
    await interaction.deleteReply().catch(() => {});
  },
};
