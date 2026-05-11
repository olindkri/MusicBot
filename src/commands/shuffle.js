import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { ensureSameVoice } from "../util/permissions.js";
import { successEmbed } from "../util/embeds.js";
import { replyError, scheduleDelete } from "../util/replies.js";

export default {
  data: new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Shuffle the remaining queue."),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return replyError(interaction, "Not connected.");
    if (!(await ensureSameVoice(interaction, player))) return;
    const n = player.queue.tracks.length;
    if (n < 2) return replyError(interaction, "Need at least 2 queued tracks to shuffle.");
    await player.queue.shuffle();
    await interaction.reply({ embeds: [successEmbed(`Shuffled ${n} upcoming tracks.`)], flags: MessageFlags.Ephemeral });
    scheduleDelete(interaction);
  },
};
