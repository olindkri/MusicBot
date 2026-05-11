import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { COLORS } from "../util/embeds.js";
import { formatDuration } from "../util/formatDuration.js";

const SOURCE_LABELS = {
  youtube: "YouTube",
  ytmusic: "YouTube Music",
  spotify: "Spotify",
  soundcloud: "SoundCloud",
  applemusic: "Apple Music",
  deezer: "Deezer",
  tidal: "Tidal",
  bandcamp: "Bandcamp",
  twitch: "Twitch",
  vimeo: "Vimeo",
  http: "Direct",
};

function sourceLabel(src) {
  if (!src) return "Unknown";
  return SOURCE_LABELS[src] || src;
}

export function buildNowPlayingEmbed(track) {
  const info = track.info;
  const requester = track.requester;

  const embed = new EmbedBuilder()
    .setColor(COLORS.brand)
    .setTitle(info.title || "Unknown title")
    .setURL(info.uri || null)
    .setAuthor({ name: "▶ Now playing" })
    .addFields(
      { name: "Artist", value: info.author || "Unknown", inline: true },
      { name: "Duration", value: info.isStream ? "🔴 LIVE" : formatDuration(info.duration), inline: true },
      { name: "Source", value: sourceLabel(info.sourceName), inline: true },
    )
    .setFooter({ text: `Requested by ${requester?.username ?? "unknown"}` });

  if (info.artworkUrl) embed.setThumbnail(info.artworkUrl);
  return embed;
}

export function buildNowPlayingRow(player) {
  const paused = player?.paused === true;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("np:playpause")
      .setLabel(paused ? "Resume" : "Pause")
      .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("np:skip")
      .setLabel("Skip")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("np:stop")
      .setLabel("Stop")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("np:shuffle")
      .setLabel("Shuffle")
      .setStyle(ButtonStyle.Primary),
  );
}

export function buildNowPlayingMessage(track, player) {
  return {
    embeds: [buildNowPlayingEmbed(track)],
    components: [buildNowPlayingRow(player)],
  };
}

export function buildQueueEndedMessage() {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.warn)
        .setAuthor({ name: "⏹ Queue ended" })
        .setDescription("Nothing left to play. Use `/play` to add more."),
    ],
    components: [],
  };
}
