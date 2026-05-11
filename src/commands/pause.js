import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { ensureSameVoice } from "../util/permissions.js";
import { errorEmbed, successEmbed } from "../util/embeds.js";

export default {
  data: new SlashCommandBuilder().setName("pause").setDescription("Pause the current track."),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player?.playing) {
      return interaction.reply({ embeds: [errorEmbed("Nothing is playing.")], flags: MessageFlags.Ephemeral });
    }
    if (!(await ensureSameVoice(interaction, player))) return;
    if (player.paused) {
      return interaction.reply({ embeds: [errorEmbed("Already paused.")], flags: MessageFlags.Ephemeral });
    }
    await player.pause();
    await interaction.reply({ embeds: [successEmbed("Paused.")], flags: MessageFlags.Ephemeral });
  },
};
