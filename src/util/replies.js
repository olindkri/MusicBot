const DEFAULT_TTL_MS = 8_000;

export function scheduleDelete(interaction, ttlMs = DEFAULT_TTL_MS) {
  setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, ttlMs);
}
