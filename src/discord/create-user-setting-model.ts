import {
  ActionRowBuilder,
  ButtonStyle,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";


export const createUserSettingModel = (isModify: boolean, defaultUpbitAccessKey?: string, defaultUpbitSecretKey?: string, defaultInitialBalance = 1000000) => {
  return new ModalBuilder()
    .setTitle(`유저 정보 ${isModify ? "수정" : "등록"}`)
    .setCustomId("user_setting_modal")
    .addComponents(
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        (() => {
          const builder = new TextInputBuilder()
            .setCustomId("upbit_access_key")
            .setLabel(`(선택) 업비트 Access Key (허용 IP에 ${process.env.SERVER_IP} 추가)`)
            .setStyle(TextInputStyle.Short)
            .setMinLength(40)
            .setMaxLength(40)
            .setRequired(false);

          if (defaultUpbitAccessKey) {
            builder.setValue(defaultUpbitAccessKey);
          }

          return builder;
        })(),
      ),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        (() => {
          const builder = new TextInputBuilder()
            .setCustomId("upbit_secret_key")
            .setLabel("(선택) 업비트 Secret Key")
            .setStyle(TextInputStyle.Short)
            .setMinLength(40)
            .setMaxLength(40)
            .setRequired(false);

          if (defaultUpbitSecretKey) {
            builder.setValue(defaultUpbitSecretKey);
          }

          return builder;
        })(),
      ),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        (() => {
          const builder = new TextInputBuilder()
            .setCustomId("initial_balance")
            .setLabel("시작 자산 (KRW) 순위를 매길 때 필요합니다.")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

          if (defaultInitialBalance) {
            builder.setValue(defaultInitialBalance.toString());
          }

          return builder;
        })(),
      ),
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("agree")
          .setLabel(`투자에 대한 책임을 인지했습니다. (동의하려면 '동의함'을 입력해주세요)`)
          .setStyle(TextInputStyle.Short)
          .setMinLength(3)
          .setMaxLength(4)
          .setRequired(true),
      ),
    );
};
