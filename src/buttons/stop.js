import { ensureSameVoice } from "../util/permissions.js";
import { buildQueueEndedMessage } from "../components/nowPlayingCard.js";
import { getGuildState } from "../state.js";

const QUEUE_ENDED_TTL_MS = 8_000;

export default {
  customId: "np:stop",
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) {
      return interaction.reply({ content: "Nothing is playing.", ephemeral: true });
    }
    if (!(await ensureSameVoice(interaction, player))) return;

    await interaction.deferUpdate();
    const state = getGuildState(player.guildId);
    state.nowPlayingMessageId = null;
    state.nowPlayingChannelId = null;
    player.queue.tracks.length = 0;
    await player.destroy("user pressed stop");
    const reply = await interaction.editReply(buildQueueEndedMessage()).catch(() => null);
    if (reply) {
      setTimeout(() => {
        reply.delete().catch(() => {});
      }, QUEUE_ENDED_TTL_MS);
    }
  },
};
