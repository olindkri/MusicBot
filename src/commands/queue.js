import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import { COLORS, errorEmbed } from "../util/embeds.js";
import { formatDuration } from "../util/formatDuration.js";

const PAGE_SIZE = 10;

export default {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the upcoming tracks.")
    .addIntegerOption((opt) =>
      opt.setName("page").setDescription("Page number (default 1)").setMinValue(1),
    ),
  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guildId);
    if (!player) {
      return interaction.reply({ embeds: [errorEmbed("Nothing in the queue.")], flags: MessageFlags.Ephemeral });
    }

    const upcoming = player.queue.tracks;
    const current = player.queue.current;
    if (upcoming.length === 0 && !current) {
      return interaction.reply({ embeds: [errorEmbed("Nothing in the queue.")], flags: MessageFlags.Ephemeral });
    }

    const requestedPage = interaction.options.getInteger("page") ?? 1;
    const totalPages = Math.max(1, Math.ceil(upcoming.length / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    const start = (page - 1) * PAGE_SIZE;
    const slice = upcoming.slice(start, start + PAGE_SIZE);

    const lines = slice.map((t, i) => {
      const num = start + i + 1;
      const title = t.info.title || "Unknown";
      const dur = t.info.isStream ? "LIVE" : formatDuration(t.info.duration);
      return `**${num}.** [${title}](${t.info.uri}) — \`${dur}\``;
    });

    const embed = new EmbedBuilder()
      .setColor(COLORS.brand)
      .setTitle(`🎵 Queue — page ${page}/${totalPages}`)
      .setDescription(lines.length ? lines.join("\n") : "_No upcoming tracks._");

    if (current) {
      embed.addFields({
        name: "▶ Now playing",
        value: `[${current.info.title}](${current.info.uri}) — \`${current.info.isStream ? "LIVE" : formatDuration(current.info.duration)}\``,
      });
    }

    embed.setFooter({ text: `${upcoming.length} track(s) queued` });

    await interaction.reply({ embeds: [embed] });
  },
};
