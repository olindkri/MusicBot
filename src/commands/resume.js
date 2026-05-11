import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { ensureSameVoice } from "../util/permissions.js";
import { successEmbed } from "../util/embeds.js";
import { replyError, scheduleDelete } from "../util/replies.js";

export default {
  data: new SlashCommandBuilder().setName("resume").setDescription("Resume the paused track."),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return replyError(interaction, "Nothing to resume.");
    if (!(await ensureSameVoice(interaction, player))) return;
    if (!player.paused) return replyError(interaction, "Already playing.");
    await player.resume();
    await interaction.reply({ embeds: [successEmbed("Resumed.")], flags: MessageFlags.Ephemeral });
    scheduleDelete(interaction);
  },
};
