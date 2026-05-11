import { errorEmbed } from "./embeds.js";

// Returns the voice channel id the user is in, or null.
export function userVoiceChannelId(interaction) {
  return interaction.member?.voice?.channelId ?? null;
}

// Guard: user must be in some voice channel. Replies ephemerally and returns false on failure.
export async function ensureInVoice(interaction) {
  const vc = userVoiceChannelId(interaction);
  if (!vc) {
    await interaction.reply({
      embeds: [errorEmbed("Join a voice channel first.")],
      ephemeral: true,
    });
    return false;
  }
  return true;
}

// Guard: user must be in the SAME voice channel as the bot's player.
export async function ensureSameVoice(interaction, player) {
  if (!(await ensureInVoice(interaction))) return false;
  if (!player || !player.voiceChannelId) return true; // bot not connected yet — allow
  const vc = userVoiceChannelId(interaction);
  if (vc !== player.voiceChannelId) {
    await interaction.reply({
      embeds: [errorEmbed("You need to be in the same voice channel as the bot.")],
      ephemeral: true,
    });
    return false;
  }
  return true;
}
