import "dotenv/config";
import { Client } from "discord.js";
import { initMongoDB } from "./models";
import { Logger } from "./utils/logger";
import { interactionController, messageController } from "./controllers";
import { tradingCronService } from "./services";

const discordClient = new Client({
  intents: ["Guilds", "GuildMessages", "MessageContent", "GuildModeration", "GuildEmojisAndStickers"],
});

initMongoDB().then(() => {
  tradingCronService.init(discordClient);
});

discordClient.on("ready", () => {
  Logger.info(`Logged in as ${discordClient.user?.tag}!`);
});

discordClient.on("messageCreate", async (message) => {
  try {
    if (message.content === "트레이딩시작할래!") {
      await messageController.startTradingGuide(message);
    } else if (
      (process.env.NODE_ENV !== "production" ? ["진짜트레이딩할래!", "테스트트레이딩할래!", "로컬트레이딩할래!"] : ["진짜트레이딩할래!", "테스트트레이딩할래!"]).includes(
        message.content,
      )
    ) {
      const isTest = message.content === "테스트트레이딩할래!";
      await messageController.executeTrading(message, { isTest });
    } else if (message.content.startsWith("<@") && message.content.endsWith("투자정보!")) {
      await messageController.getInvestmentInfo(message);
    }
  } catch (error: any) {
    Logger.error(error);
    await message.reply({
      content: error.message || "알 수 없는 오류가 발생했습니다.",
    });
  }
});

discordClient.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isButton()) {
      switch (interaction.customId) {
        case "open_user_setting_modal":
          await interactionController.openUserSettingModal(interaction);
          break;
        case "open_prompt_setting_modal":
          await interactionController.openPromptSettingModal(interaction);
          break;
        case "remove_user_setting":
          await interactionController.removeUserSetting(interaction);
          break;
        default:
          Logger.warn(`Unhandled button customId: ${interaction.customId}`);
          break;
      }
    } else if (interaction.isModalSubmit()) {
      switch (interaction.customId) {
        case "user_setting_modal":
          await interactionController.submitUserSettingModal(interaction);
          break;
        case "prompt_setting_modal":
          await interactionController.submitPromptSettingModal(interaction);
          break;
        default:
          Logger.warn(`Unhandled modal customId: ${interaction.customId}`);
          break;
      }
    }
  } catch (error: any) {
    Logger.error(error);
    if (interaction.isButton() || interaction.isModalSubmit()) {
      await interaction.reply({
        content: error.message || "알 수 없는 오류가 발생했습니다.",
        ephemeral: true,
      });
    }
  }
});

process.on("unhandledRejection", (error) => {
  console.error(error);
});

discordClient.login(process.env.DISCORD_BOT_TOKEN);
