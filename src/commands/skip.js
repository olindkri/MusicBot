import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { ensureSameVoice } from "../util/permissions.js";
import { errorEmbed, successEmbed } from "../util/embeds.js";
import { scheduleDelete } from "../util/replies.js";

export default {
  data: new SlashCommandBuilder().setName("skip").setDescription("Skip to the next track."),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player?.playing) {
      await interaction.reply({ embeds: [errorEmbed("Nothing is playing.")], flags: MessageFlags.Ephemeral });
      scheduleDelete(interaction);
      return;
    }
    if (!(await ensureSameVoice(interaction, player))) return;
    await player.skip();
    await interaction.reply({ embeds: [successEmbed("Skipped.")], flags: MessageFlags.Ephemeral });
    scheduleDelete(interaction);
  },
};
