import { ensureSameVoice } from "../util/permissions.js";

export default {
  customId: "np:stop",
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) {
      return interaction.reply({ content: "Nothing is playing.", ephemeral: true });
    }
    if (!(await ensureSameVoice(interaction, player))) return;

    await interaction.deferUpdate();
    player.queue.tracks.length = 0;
    await player.destroy("user pressed stop");
    // playerDestroy handler in lavalink.js deletes the now-playing card.
  },
};
