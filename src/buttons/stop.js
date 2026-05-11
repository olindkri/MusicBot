import { ensureSameVoice } from "../util/permissions.js";
import { replyError } from "../util/replies.js";

export default {
  customId: "np:stop",
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return replyError(interaction, "Nothing is playing.");
    if (!(await ensureSameVoice(interaction, player))) return;

    await interaction.deferUpdate();
    player.queue.tracks.length = 0;
    await player.destroy("user pressed stop");
  },
};
