import { ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import { UserService } from "../services/user-service";
import { TradingService } from "../services/trading-service";
import { TradingCronService } from "../services/trading-cron-service";
import { createUserSettingModel } from "../discord/create-user-setting-model";
import { createPromptSettingModel } from "../discord/create-prompt-setting-model";
import { Logger } from "../utils/logger";

export class InteractionController {
  constructor(
    private userService: UserService,
    private tradingService: TradingService,
    private tradingCronService: TradingCronService,
  ) {
  }

  async openUserSettingModal(interaction: ButtonInteraction) {
    const user = await this.userService.getUser(interaction.user.id);
    interaction.showModal(createUserSettingModel(!!user, user?.upbitApiKey, user?.upbitSecretKey, user?.initialBalance).toJSON());
  }

  async openPromptSettingModal(interaction: ButtonInteraction) {
    const user = await this.userService.getUser(interaction.user.id);
    if (!user) {
      await interaction.reply({ content: "유저 정보를 먼저 등록해주세요.", ephemeral: true });
      return;
    }
    const prompt = await this.tradingService.getTradeByUserId(interaction.user.id);

    interaction.showModal(createPromptSettingModel(prompt || undefined).toJSON());
  }

  async removeUserSetting(interaction: ButtonInteraction) {
    try {
      const user = await this.userService.getUser(interaction.user.id);
      if (!user) {
        throw new Error("유저 정보가 없습니다.");
      }

      await this.userService.deleteUser(interaction.user.id);
      await this.tradingCronService.removeTradeCronByUserId(interaction.user.id);
      await this.tradingService.removeTradeInfoByUserId(interaction.user.id);
      await interaction.reply({ content: "유저 정보 삭제가 완료되었습니다.", ephemeral: true });
    } catch (error: any) {
      console.error(error);
      await interaction.reply({ content: error.message || "오류가 발생했습니다.", ephemeral: true });
    }
  }

  async submitUserSettingModal(interaction: ModalSubmitInteraction) {
    const agree = interaction.fields.getTextInputValue("agree");
    if (agree !== "동의함") {
      await interaction.reply({ content: "동의를 하셔야 합니다.", ephemeral: true });
      return;
    }
    try {
      await this.userService.upsertUser({
        userId: interaction.user.id,
        serverId: interaction.guildId!,
        channelId: interaction.channelId!,
        upbitApiKey: interaction.fields.getTextInputValue("upbit_access_key") || undefined,
        upbitSecretKey: interaction.fields.getTextInputValue("upbit_secret_key") || undefined,
        initialBalance: Number(interaction.fields.getTextInputValue("initial_balance")),
        nickname: interaction.user.username,
      });
      await interaction.reply({ content: "유저 정보 등록이 완료되었습니다.", ephemeral: true });
    } catch (error: any) {
      console.error(error);
      await interaction.reply({ content: error.message || "오류가 발생했습니다.", ephemeral: true });
    }
  }

  async submitPromptSettingModal(interaction: ModalSubmitInteraction) {
    try {
      const user = await this.userService.getUser(interaction.user.id);
      if (!user) {
        throw new Error("유저 정보를 먼저 등록해주세요. (채팅에 '트레이딩시작할래!'를 입력해주세요.)");
      }
      let cronTime = user.upbitApiKey ? interaction.fields.getTextInputValue("cron") : "";

      if (cronTime) {
        cronTime = cronTime.split(",").map((time) => Number(time.trim())).join(",");
        cronTime = `0 0 ${cronTime} * * *`;
      }

      if (cronTime && !this.tradingCronService.validateCronTime(cronTime)) {
        throw new Error("올바른 시간이 아닙니다. 다시 입력해주세요.");
      }

      await this.tradingCronService.removeTradeCronByUserId(interaction.user.id);

      await this.tradingService.upsertTradeInfo(interaction.user.id, {
        userMessage: interaction.fields.getTextInputValue("user_message"),
        cronTime: cronTime || undefined,
      });

      if (cronTime) {
        this.tradingCronService.addTradeCron(interaction.user.id, cronTime);
      }

      await interaction.reply({
        content: `<@${interaction.user.id}>님의 프롬프트 정보 등록이 완료되었습니다.\n프롬프트: \`\`\`${interaction.fields.getTextInputValue(
          "user_message",
        )}\`\`\`\n시간: ${cronTime || "없음"}`,
      });
    } catch (error: any) {
      Logger.error(error);
      await interaction.reply({
        content: `${error.message || "오류가 발생했습니다."}\n입력 프롬프트: ${interaction.fields.getTextInputValue("user_message")}\n입력 시간: ${interaction.fields.getTextInputValue("cron") || "없음"}`,
        ephemeral: true,
      });
    }
  }
}
