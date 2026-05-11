import { replyError } from "./replies.js";

export function userVoiceChannelId(interaction) {
  return interaction.member?.voice?.channelId ?? null;
}

export async function ensureInVoice(interaction) {
  if (!userVoiceChannelId(interaction)) {
    await replyError(interaction, "Join a voice channel first.");
    return false;
  }
  return true;
}

export async function ensureSameVoice(interaction, player) {
  if (!(await ensureInVoice(interaction))) return false;
  if (!player || !player.voiceChannelId) return true;
  if (userVoiceChannelId(interaction) !== player.voiceChannelId) {
    await replyError(interaction, "You need to be in the same voice channel as the bot.");
    return false;
  }
  return true;
}
