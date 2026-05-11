import { ensureSameVoice } from "../util/permissions.js";
import { infoEmbed } from "../util/embeds.js";

export default {
  customId: "np:shuffle",
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) {
      return interaction.reply({ content: "Nothing is playing.", ephemeral: true });
    }
    if (!(await ensureSameVoice(interaction, player))) return;

    const upcoming = player.queue.tracks;
    if (upcoming.length < 2) {
      return interaction.reply({
        embeds: [infoEmbed("Nothing to shuffle — less than 2 tracks queued.")],
        ephemeral: true,
      });
    }

    await player.queue.shuffle();
    await interaction.reply({
      embeds: [infoEmbed(`🔀 Shuffled ${upcoming.length} upcoming tracks.`)],
      ephemeral: true,
    });
  },
};
