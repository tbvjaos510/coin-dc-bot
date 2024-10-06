import {
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { IAITrading } from "../models/ai-tradings";


export const createPromptSettingModel = (defaultValue?: Partial<IAITrading>) => {
  return new ModalBuilder()
    .setTitle(`프롬프트 & 매매 ${defaultValue ? "수정" : "등록"}`)
    .setCustomId("prompt_setting_modal")
    .addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("system_message")
          .setLabel("시스템 프롬프트")
          .setStyle(TextInputStyle.Paragraph)
          .setValue(defaultValue?.systemMessage ?? "")
          .setMaxLength(300),
      ),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("user_message")
          .setLabel("사용자 프롬프트")
          .setStyle(TextInputStyle.Paragraph)
          .setValue(defaultValue?.userMessage ?? "")
          .setMaxLength(3000)
          .setRequired(true),
      ),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("cron")
          .setLabel("자동 매매 시간 (콤마로 구분. 업비트 API 등록 시에만 필요)")
          .setStyle(TextInputStyle.Short)
          .setPlaceholder("0,6,12,18")
          .setValue(defaultValue?.cronTime ?? "0,6,12,18")
          .setRequired(false),
      )
    );
};
