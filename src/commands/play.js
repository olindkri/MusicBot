import { SlashCommandBuilder } from "discord.js";
import { ensureInVoice, ensureSameVoice, userVoiceChannelId } from "../util/permissions.js";
import { errorEmbed, infoEmbed } from "../util/embeds.js";
import { formatDuration } from "../util/formatDuration.js";

export default {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a track or playlist from a URL or search query.")
    .addStringOption((opt) =>
      opt.setName("query").setDescription("URL or search terms").setRequired(true),
    ),

  async execute(interaction) {
    if (!(await ensureInVoice(interaction))) return;

    const query = interaction.options.getString("query", true);
    const guildId = interaction.guildId;
    const manager = interaction.client.lavalink;

    let player = manager.getPlayer(guildId);
    if (player && !(await ensureSameVoice(interaction, player))) return;

    if (!player) {
      player = manager.createPlayer({
        guildId,
        voiceChannelId: userVoiceChannelId(interaction),
        textChannelId: interaction.channelId,
        selfDeaf: true,
        volume: 80,
      });
    }

    if (!player.connected) await player.connect();

    await interaction.deferReply();

    let result;
    try {
      result = await player.search({ query }, interaction.user);
    } catch (err) {
      console.error("[/play] search error:", err);
      return interaction.editReply({ embeds: [errorEmbed("Audio service is down. Try again in a moment.")] });
    }

    if (!result || !result.tracks?.length) {
      return interaction.editReply({ embeds: [errorEmbed("Nothing found for that query.")] });
    }

    const isPlaylist = result.loadType === "playlist";

    if (isPlaylist) {
      await player.queue.add(result.tracks);
    } else {
      await player.queue.add(result.tracks[0]);
    }

    const wasIdle = !player.playing && !player.paused;
    if (wasIdle) await player.play();

    if (wasIdle && !isPlaylist) {
      await interaction.deleteReply().catch(() => {});
      return;
    }

    const queuedReplyTtlMs = 8_000;
    if (isPlaylist) {
      const name = result.playlist?.name ?? "Playlist";
      await interaction.editReply({
        embeds: [infoEmbed(`➕ Queued **${result.tracks.length}** tracks from **${name}**.`)],
      });
    } else {
      const t = result.tracks[0].info;
      await interaction.editReply({
        embeds: [infoEmbed(`➕ Queued **${t.title}** (${formatDuration(t.duration)})`)],
      });
    }
    setTimeout(() => {
      interaction.deleteReply().catch(() => {});
    }, queuedReplyTtlMs);
  },
};
