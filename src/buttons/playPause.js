import { ensureSameVoice } from "../util/permissions.js";
import { buildNowPlayingRow } from "../components/nowPlayingCard.js";
import { replyError } from "../util/replies.js";

export default {
  customId: "np:playpause",
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) return replyError(interaction, "Nothing is playing.");
    if (!(await ensureSameVoice(interaction, player))) return;

    if (player.paused) await player.resume();
    else await player.pause();

    await interaction.update({ components: [buildNowPlayingRow(player)] });
  },
};
