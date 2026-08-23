import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { COLORS } from "../util/embeds.js";
import { formatDuration } from "../util/formatDuration.js";

export function buildNowPlayingEmbed(track) {
  const info = track.info;

  // Title, artist and duration only: the thumbnail renders at a fixed ~80px, so
  // keeping the card to three short lines is what lets the artwork span its
  // full height.
  const duration = info.isStream ? "LIVE" : formatDuration(info.duration);

  const embed = new EmbedBuilder()
    .setColor(COLORS.brand)
    .setTitle(info.title || "Unknown title")
    .setURL(info.uri || null)
    .setAuthor({ name: "Now playing" })
    .setDescription(`**${info.author || "Unknown"}** \u00b7 ${duration}`);

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

