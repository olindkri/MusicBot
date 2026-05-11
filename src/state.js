// In-memory per-guild state. Resets on bot restart (by design for v1).
//
// Shape per guild:
//   {
//     nowPlayingMessageId: string | null,   // id of the now-playing card message
//     nowPlayingChannelId: string | null,   // text channel the card lives in
//     leaveTimer: NodeJS.Timeout | null,    // auto-disconnect timer when voice channel empty
//   }
const guildState = new Map();

export function getGuildState(guildId) {
  if (!guildState.has(guildId)) {
    guildState.set(guildId, {
      nowPlayingMessageId: null,
      nowPlayingChannelId: null,
      leaveTimer: null,
    });
  }
  return guildState.get(guildId);
}

export function clearGuildState(guildId) {
  const s = guildState.get(guildId);
  if (s?.leaveTimer) clearTimeout(s.leaveTimer);
  guildState.delete(guildId);
}
