import { ensureSameVoice } from "../util/permissions.js";

export default {
  customId: "np:skip",
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player || !player.playing) {
      return interaction.reply({ content: "Nothing is playing.", ephemeral: true });
    }
    if (!(await ensureSameVoice(interaction, player))) return;

    await interaction.deferUpdate();
    await player.skip();
    // trackStart will edit the card to the new track; queueEnd will finalise if nothing follows.
  },
};
