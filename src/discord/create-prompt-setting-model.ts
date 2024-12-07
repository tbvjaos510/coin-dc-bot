import {
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { IAITrading } from "../models/ai-tradings";

const cronToHours = (cron: string) => {
  return cron.split(" ")[2];
};

export const createPromptSettingModel = (defaultValue?: Partial<IAITrading>) => {
  return new ModalBuilder()
    .setTitle(`프롬프트 & 매매 ${defaultValue ? "수정" : "등록"}`)
    .setCustomId("prompt_setting_modal")
    .addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("user_message")
          .setLabel("프롬프트")
          .setStyle(TextInputStyle.Paragraph)
          .setValue(defaultValue?.userMessage ?? "")
          .setMaxLength(4000)
          .setRequired(true),
      ),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("model")
          .setLabel("사용할 모델 (gpt or claude)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("gpt")
          .setValue(defaultValue?.model ?? "gpt")
          .setRequired(true),
      ),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("cron")
          .setLabel("자동 매매 시간 (콤마로 구분. 업비트 API 등록 시에만 필요)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("0,6,12,18")
          .setValue(defaultValue?.cronTime ? cronToHours(defaultValue.cronTime) : "0")
          .setRequired(false),
      ),
    );
};
