import { errorEmbed } from "./embeds.js";
import { scheduleDelete } from "./replies.js";

export function userVoiceChannelId(interaction) {
  return interaction.member?.voice?.channelId ?? null;
}

export async function ensureInVoice(interaction) {
  const vc = userVoiceChannelId(interaction);
  if (!vc) {
    await interaction.reply({
      embeds: [errorEmbed("Join a voice channel first.")],
      ephemeral: true,
    });
    scheduleDelete(interaction);
    return false;
  }
  return true;
}

export async function ensureSameVoice(interaction, player) {
  if (!(await ensureInVoice(interaction))) return false;
  if (!player || !player.voiceChannelId) return true;
  const vc = userVoiceChannelId(interaction);
  if (vc !== player.voiceChannelId) {
    await interaction.reply({
      embeds: [errorEmbed("You need to be in the same voice channel as the bot.")],
      ephemeral: true,
    });
    scheduleDelete(interaction);
    return false;
  }
  return true;
}
