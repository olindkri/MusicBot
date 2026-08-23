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

  // Artist/duration/source live on single lines rather than in a field row: the
  // thumbnail renders at a fixed ~80px, so a shorter card is the only way to let
  // the artwork span its full height.
  const duration = info.isStream ? "LIVE" : formatDuration(info.duration);

  const embed = new EmbedBuilder()
    .setColor(COLORS.brand)
    .setTitle(info.title || "Unknown title")
    .setURL(info.uri || null)
    .setAuthor({ name: "Now playing" })
    .setDescription(`**${info.author || "Unknown"}** \u00b7 ${duration}`)
    .setFooter({
      text: `${sourceLabel(info.sourceName)} \u00b7 Requested by ${requester?.username ?? "unknown"}`,
    });

  if (info.artworkUrl) embed.setThumbnail(info.artworkUrl);
  return embed;
}

export function buildNowPlayingRow(player) {
  const paused = player?.paused === true;
  // Shuffle needs at least two upcoming tracks to do anything — same rule the
  // button handler enforces, so hide it rather than offer a guaranteed error.
  const canShuffle = (player?.queue?.tracks?.length ?? 0) >= 2;

  const buttons = [
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
  ];

  if (canShuffle) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId("np:shuffle")
        .setLabel("Shuffle")
        .setStyle(ButtonStyle.Primary),
    );
  }

  return new ActionRowBuilder().addComponents(...buttons);
}

export function buildNowPlayingMessage(track, player) {
  return {
    embeds: [buildNowPlayingEmbed(track)],
    components: [buildNowPlayingRow(player)],
  };
}

