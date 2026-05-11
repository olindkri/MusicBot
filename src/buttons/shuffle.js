import { MessageFlags } from "discord.js";
import { ensureSameVoice } from "../util/permissions.js";
import { infoEmbed } from "../util/embeds.js";
import { replyError, scheduleDelete } from "../util/replies.js";

export default {
  customId: "np:shuffle",
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return replyError(interaction, "Nothing is playing.");
    if (!(await ensureSameVoice(interaction, player))) return;

    const upcoming = player.queue.tracks;
    if (upcoming.length < 2) return replyError(interaction, "Nothing to shuffle — less than 2 tracks queued.");

    await player.queue.shuffle();
    await interaction.reply({
      embeds: [infoEmbed(`Shuffled ${upcoming.length} upcoming tracks.`)],
      flags: MessageFlags.Ephemeral,
    });
    scheduleDelete(interaction);
  },
};
