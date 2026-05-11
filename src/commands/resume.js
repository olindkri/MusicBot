import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { ensureSameVoice } from "../util/permissions.js";
import { errorEmbed, successEmbed } from "../util/embeds.js";

export default {
  data: new SlashCommandBuilder().setName("resume").setDescription("Resume the paused track."),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) {
      return interaction.reply({ embeds: [errorEmbed("Nothing to resume.")], flags: MessageFlags.Ephemeral });
    }
    if (!(await ensureSameVoice(interaction, player))) return;
    if (!player.paused) {
      return interaction.reply({ embeds: [errorEmbed("Already playing.")], flags: MessageFlags.Ephemeral });
    }
    await player.resume();
    await interaction.reply({ embeds: [successEmbed("Resumed.")], flags: MessageFlags.Ephemeral });
  },
};
