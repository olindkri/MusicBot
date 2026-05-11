import { SlashCommandBuilder } from "discord.js";
import { ensureInVoice, ensureSameVoice, userVoiceChannelId } from "../util/permissions.js";
import { errorEmbed, infoEmbed } from "../util/embeds.js";
import { formatDuration } from "../util/formatDuration.js";
import { scheduleDelete } from "../util/replies.js";
import { parseSpotifyUrl, fetchSpotifyPlaylist, fetchSpotifyAlbum } from "../util/spotify.js";
import { randomIntroQuery } from "../util/intros.js";

const SEARCH_CHUNK_SIZE = 10;

async function resolveSpotifyBundle(player, requester, trackUrls) {
  const tracks = [];
  for (let i = 0; i < trackUrls.length; i += SEARCH_CHUNK_SIZE) {
    const slice = trackUrls.slice(i, i + SEARCH_CHUNK_SIZE);
    const results = await Promise.all(
      slice.map((url) => player.search({ query: url }, requester).catch(() => null)),
    );
    for (const r of results) {
      if (r?.tracks?.[0]) tracks.push(r.tracks[0]);
    }
  }
  return tracks;
}

async function prependIntro(player, requester) {
  try {
    const result = await player.search({ query: randomIntroQuery() }, requester);
    const intro = result?.tracks?.[0];
    if (intro) player.queue.tracks.unshift(intro);
  } catch (err) {
    console.warn("[/play] could not load intro:", err.message);
  }
}

export default {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a track, playlist, or album from a URL or search query.")
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

    await interaction.deferReply();

    const justJoining = !player || !player.connected;

    if (!player) {
      player = manager.createPlayer({
        guildId,
        voiceChannelId: userVoiceChannelId(interaction),
        textChannelId: interaction.channelId,
        selfDeaf: true,
        volume: 80,
      });
    }

    const spotify = parseSpotifyUrl(query);
    if (spotify && (spotify.type === "playlist" || spotify.type === "album")) {
      let bundle;
      try {
        bundle = spotify.type === "playlist"
          ? await fetchSpotifyPlaylist(spotify.id)
          : await fetchSpotifyAlbum(spotify.id);
      } catch (err) {
        console.error("[/play] spotify api error:", err);
        await interaction.editReply({ embeds: [errorEmbed("Couldn't read that Spotify playlist/album.")] });
        scheduleDelete(interaction);
        return;
      }
      if (!bundle.trackUrls.length) {
        await interaction.editReply({ embeds: [errorEmbed("Playlist is empty.")] });
        scheduleDelete(interaction);
        return;
      }

      const tracks = await resolveSpotifyBundle(player, interaction.user, bundle.trackUrls);
      if (!tracks.length) {
        await interaction.editReply({ embeds: [errorEmbed("Couldn't resolve any tracks from that playlist.")] });
        scheduleDelete(interaction);
        return;
      }

      if (!player.connected) await player.connect();
      await player.queue.add(tracks);
      if (justJoining) await prependIntro(player, interaction.user);
      const wasIdle = !player.playing && !player.paused;
      if (wasIdle) {
        if (justJoining) await new Promise((r) => setTimeout(r, 1000));
        await player.play();
      }

      await interaction.editReply({
        embeds: [infoEmbed(`Queued **${tracks.length}** tracks from **${bundle.name}**.`)],
      });
      scheduleDelete(interaction);
      return;
    }

    let result;
    try {
      result = await player.search({ query }, interaction.user);
    } catch (err) {
      console.error("[/play] search error:", err);
      await interaction.editReply({ embeds: [errorEmbed("Audio service is down. Try again in a moment.")] });
      scheduleDelete(interaction);
      return;
    }

    if (!result || !result.tracks?.length) {
      await interaction.editReply({ embeds: [errorEmbed("Nothing found for that query.")] });
      scheduleDelete(interaction);
      return;
    }

    if (!player.connected) await player.connect();

    const isPlaylist = result.loadType === "playlist";
    if (isPlaylist) await player.queue.add(result.tracks);
    else await player.queue.add(result.tracks[0]);

    if (justJoining) await prependIntro(player, interaction.user);

    const wasIdle = !player.playing && !player.paused;
    if (wasIdle) {
      if (justJoining) await new Promise((r) => setTimeout(r, 1000));
      await player.play();
    }

    if (wasIdle && !isPlaylist && !justJoining) {
      await interaction.deleteReply().catch(() => {});
      return;
    }

    if (isPlaylist) {
      const name = result.playlist?.name ?? "Playlist";
      await interaction.editReply({
        embeds: [infoEmbed(`Queued **${result.tracks.length}** tracks from **${name}**.`)],
      });
    } else {
      const t = result.tracks[0].info;
      await interaction.editReply({
        embeds: [infoEmbed(`Queued **${t.title}** (${formatDuration(t.duration)})`)],
      });
    }
    scheduleDelete(interaction);
  },
};
