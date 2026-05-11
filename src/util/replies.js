import { MessageFlags } from "discord.js";
import { errorEmbed } from "./embeds.js";

const DEFAULT_TTL_MS = 8_000;

export function scheduleDelete(interaction, ttlMs = DEFAULT_TTL_MS) {
  setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, ttlMs);
}

export async function replyError(interaction, message) {
  await interaction.reply({
    embeds: [errorEmbed(message)],
    flags: MessageFlags.Ephemeral,
  });
  scheduleDelete(interaction);
}
