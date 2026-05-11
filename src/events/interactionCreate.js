import { Events, MessageFlags } from "discord.js";
import { errorEmbed } from "../util/embeds.js";
import { scheduleDelete } from "../util/replies.js";

async function safeErrorReply(interaction, message) {
  const payload = {
    embeds: [errorEmbed(message)],
    flags: MessageFlags.Ephemeral,
  };
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
    scheduleDelete(interaction);
  } catch (err) {
    console.error("[interactionCreate] failed to send error reply:", err);
  }
}

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        const cmd = interaction.client.commands.get(interaction.commandName);
        if (!cmd) {
          return safeErrorReply(interaction, `Unknown command: ${interaction.commandName}`);
        }
        await cmd.execute(interaction);
        return;
      }

      if (interaction.isButton()) {
        const handler = interaction.client.buttons.get(interaction.customId);
        if (!handler) {
          return safeErrorReply(interaction, "This button is no longer active. Run `/play` again.");
        }
        await handler.execute(interaction);
        return;
      }
    } catch (err) {
      console.error(`[interactionCreate] handler threw for ${interaction.commandName ?? interaction.customId}:`, err);
      await safeErrorReply(interaction, "Something went wrong. The error has been logged.");
    }
  },
};
