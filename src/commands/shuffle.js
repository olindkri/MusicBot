import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { ensureSameVoice } from "../util/permissions.js";
import { errorEmbed, successEmbed } from "../util/embeds.js";
import { scheduleDelete } from "../util/replies.js";

export default {
  data: new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Shuffle the remaining queue."),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) {
      await interaction.reply({ embeds: [errorEmbed("Not connected.")], flags: MessageFlags.Ephemeral });
      scheduleDelete(interaction);
      return;
    }
    if (!(await ensureSameVoice(interaction, player))) return;
    const n = player.queue.tracks.length;
    if (n < 2) {
      await interaction.reply({
        embeds: [errorEmbed("Need at least 2 queued tracks to shuffle.")],
        flags: MessageFlags.Ephemeral,
      });
      scheduleDelete(interaction);
      return;
    }
    await player.queue.shuffle();
    await interaction.reply({ embeds: [successEmbed(`Shuffled ${n} upcoming tracks.`)], flags: MessageFlags.Ephemeral });
    scheduleDelete(interaction);
  },
};
