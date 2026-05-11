import { EmbedBuilder } from "discord.js";

export const COLORS = {
  brand: 0x5865F2,
  success: 0x57F287,
  warn: 0xFEE75C,
  error: 0xED4245,
};

export function errorEmbed(message) {
  return new EmbedBuilder().setColor(COLORS.error).setDescription(`❌ ${message}`);
}

export function infoEmbed(message) {
  return new EmbedBuilder().setColor(COLORS.brand).setDescription(message);
}

export function successEmbed(message) {
  return new EmbedBuilder().setColor(COLORS.success).setDescription(`✅ ${message}`);
}
