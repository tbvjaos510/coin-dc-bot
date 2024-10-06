import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

export const createInlineButton = (text: string, actionId: string, style = ButtonStyle.Primary) => {
  const button = new ActionRowBuilder<ButtonBuilder>();

  button.addComponents(
    new ButtonBuilder()
      .setCustomId(actionId)
      .setLabel(text)
      .setStyle(style),
  );

  return button;
};
