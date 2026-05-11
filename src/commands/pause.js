import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { ensureSameVoice } from "../util/permissions.js";
import { successEmbed } from "../util/embeds.js";
import { replyError, scheduleDelete } from "../util/replies.js";

export default {
  data: new SlashCommandBuilder().setName("pause").setDescription("Pause the current track."),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player?.playing) return replyError(interaction, "Nothing is playing.");
    if (!(await ensureSameVoice(interaction, player))) return;
    if (player.paused) return replyError(interaction, "Already paused.");
    await player.pause();
    await interaction.reply({ embeds: [successEmbed("Paused.")], flags: MessageFlags.Ephemeral });
    scheduleDelete(interaction);
  },
};
