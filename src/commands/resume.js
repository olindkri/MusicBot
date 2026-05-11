import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { ensureSameVoice } from "../util/permissions.js";
import { errorEmbed, successEmbed } from "../util/embeds.js";
import { scheduleDelete } from "../util/replies.js";

export default {
  data: new SlashCommandBuilder().setName("resume").setDescription("Resume the paused track."),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) {
      await interaction.reply({ embeds: [errorEmbed("Nothing to resume.")], flags: MessageFlags.Ephemeral });
      scheduleDelete(interaction);
      return;
    }
    if (!(await ensureSameVoice(interaction, player))) return;
    if (!player.paused) {
      await interaction.reply({ embeds: [errorEmbed("Already playing.")], flags: MessageFlags.Ephemeral });
      scheduleDelete(interaction);
      return;
    }
    await player.resume();
    await interaction.reply({ embeds: [successEmbed("Resumed.")], flags: MessageFlags.Ephemeral });
    scheduleDelete(interaction);
  },
};
