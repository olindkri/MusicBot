import { ensureSameVoice } from "../util/permissions.js";
import { replyError } from "../util/replies.js";

export default {
  customId: "np:skip",
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player || !player.playing) return replyError(interaction, "Nothing is playing.");
    if (!(await ensureSameVoice(interaction, player))) return;

    await interaction.deferUpdate();
    if (player.queue.tracks.length === 0) {
      await player.destroy("skip on last track");
      return;
    }
    await player.skip();
  },
};
