import "dotenv/config";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client } from "discord.js";
import { initMongoDB } from "./models";
import { createUserSettingModel } from "./discord/create-user-setting-model";
import { createPromptSettingModel } from "./discord/create-prompt-setting-model";
import { tradingController, userController } from "./controllers";
import { tradingCron } from "./containers/cron";
import { prettyMyAccount } from "./tools/upbit-account";
import { Logger } from "./utils/logger";

const discordClient = new Client({
  intents: ["Guilds", "GuildMessages", "MessageContent", "GuildModeration", "GuildEmojisAndStickers"],
});

initMongoDB().then(() => {
  tradingCron.init(discordClient);
});

discordClient.on("ready", () => {
  Logger.info(`Logged in as ${discordClient.user?.tag}!`);
});

discordClient.on("messageCreate", async (message) => {
  if (message.content === "트레이딩시작할래!") {
    const buttonGroup = new ActionRowBuilder<ButtonBuilder>();
    buttonGroup.addComponents(
      new ButtonBuilder()
        .setCustomId("open_user_setting_modal")
        .setLabel("유저 정보 등록")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("open_prompt_setting_modal")
        .setLabel("프롬프트 정보 등록")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("remove_user_setting")
        .setLabel("유저 & 프롬프트 정보 삭제")
        .setStyle(ButtonStyle.Danger),
    );

    await message.reply({
      content: "매매를 위해 필요한 정보를 등록해주세요.\n유저 정보 등록을 먼저 한 후, 프롬프트 정보 등록을 해주세요.",
      components: [
        buttonGroup,
      ],
    });
  }

  if (message.content === "진짜트레이딩할래!" || message.content === "테스트트레이딩할래!" || (process.env.NODE_ENV !== "production" && message.content === "로컬트레이딩할래!")) {
    const isTest = message.content === "테스트트레이딩할래!";
    const user = await userController.getUser(message.author.id);

    if (!user) {
      await message.reply({
        content: "유저 정보를 먼저 등록해주세요. (채팅에 '트레이딩시작할래!'를 입력해주세요.)",
      });

      return;
    }

    const prompt = await tradingController.getTradeByUserId(message.author.id);

    if (!prompt) {
      await message.reply({
        content: "프롬프트 정보를 먼저 등록해주세요. (채팅에 '트레이딩시작할래!'를 입력해주세요.)",
      });

      return;
    }

    const reply = await message.reply({
      content: `트레이딩 진행중... 약 1분정도 소요됩니다 :hourglass_flowing_sand:${isTest ? "\n테스트 매매는 매매 기록이 저장되지 않습니다." : ""}`,
    });

    try {
      const {
        lastMessageContent,
        account,
        history,
      } = await tradingController.executeTrading(prompt._id, message.content === "테스트트레이딩할래!");

      await reply.edit({
        content: lastMessageContent + (await prettyMyAccount(account)).message,
        files: [
          {
            name: "trading-history.txt",
            attachment: Buffer.from(JSON.stringify(history, null, 2)),
          },
        ],
      });
    } catch (error: any) {
      console.error(error);
      await reply.edit({
        content: error.message ?? "알 수 없는 오류가 발생했습니다.",
      });
    }
  }

  if (message.content.startsWith("<@") && message.content.endsWith("투자정보!")) {
    const targetUserId = message.mentions.users.first()?.id || message.author.id;

    const account = await tradingController.getTradeAccount(targetUserId);

    if (!account) {
      await message.reply({
        content: "해당 유저의 정보가 없습니다.",
      });

      return;
    }

    const prettyAccount = await prettyMyAccount(account);

    await message.reply({
      content: `<@${targetUserId}>님의 계좌 정보입니다.\n${prettyAccount.message}`,
    });
  }
});

discordClient.on("interactionCreate", async (interaction) => {
  try {

    if (interaction.isButton()) {
      if (interaction.customId === "open_user_setting_modal") {
        const user = await userController.getUser(interaction.user.id);

        interaction.showModal(createUserSettingModel(Boolean(user), user?.upbitApiKey, user?.upbitSecretKey, user?.initialBalance));
      }
      if (interaction.customId === "open_prompt_setting_modal") {
        const user = await userController.getUser(interaction.user.id);

        if (!user) {
          await interaction.reply({
            content: "유저 정보를 먼저 등록해주세요.",
            ephemeral: true,
          });

          return;
        }

        const prompt = await tradingController.getTradeByUserId(interaction.user.id);


        interaction.showModal(createPromptSettingModel(prompt ? {
          ...prompt,
          cronTime: prompt.cronTime ? /0 0 ([\d,]+) \* \* \*/.exec(prompt.cronTime)?.[1] : "0,6,12,18",
        } : undefined));
      }
      if (interaction.customId === "remove_user_setting") {
        try {
          await userController.deleteUser(interaction.user.id);
          await tradingController.removeTradeInfo(interaction.user.id);

          await interaction.reply({
            content: "유저 정보 삭제가 완료되었습니다.",
            ephemeral: true,
          });
        } catch (error: any) {
          console.error(error);
          await interaction.reply({
            content: error.message ?? "알 수 없는 오류가 발생했습니다.",
            ephemeral: true,
          });
        }
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === "user_setting_modal") {
        const agree = interaction.fields.getTextInputValue("agree");

        if (agree !== "동의함") {
          await interaction.reply({
            content: "동의를 하셔야 합니다.",
            ephemeral: true,
          });

          return;
        }

        try {
          await userController.upsertUser({
            userId: interaction.user.id,
            serverId: interaction.guildId!,
            channelId: interaction.channelId!,
            upbitApiKey: interaction.fields.getTextInputValue("upbit_access_key") || undefined,
            upbitSecretKey: interaction.fields.getTextInputValue("upbit_secret_key") || undefined,
            initialBalance: Number(interaction.fields.getTextInputValue("initial_balance")),
            nickname: interaction.user.username,
          });

          const hasUpbit = Boolean(interaction.fields.getTextInputValue("upbit_access_key"));

          await interaction.reply({
            content: "유저 정보 등록이 완료되었습니다.\n" + (hasUpbit ? "업비트 API 등록이 완료되었습니다." : "업비트 API 등록을 하지 않았습니다. 테스트 매매만 가능합니다."),
            ephemeral: true,
          });
        } catch (error: any) {
          console.error(error);
          await interaction.reply({
            content: error.message ?? "알 수 없는 오류가 발생했습니다.",
            ephemeral: true,
          });
        }
      }

      if (interaction.customId === "prompt_setting_modal") {
        try {
          const user = await userController.getUser(interaction.user.id);

          if (!user) {
            await interaction.reply({
              content: "유저 정보를 먼저 등록해주세요. (채팅에 '트레이딩시작할래!'를 입력해주세요.)",
              ephemeral: true,
            });

            return;
          }

          let cronTime = user.upbitApiKey ? interaction.fields.getTextInputValue("cron") : "";

          if (cronTime) {
            cronTime = cronTime.split(",").map((time) => Number(time.trim())).join(",");
            cronTime = `0 0 ${cronTime} * * *`;
          }

          await tradingController.upsertTradeInfo(interaction.user.id, {
            userMessage: interaction.fields.getTextInputValue("user_message"),
            cronTime: cronTime || undefined,
          });

          await interaction.reply({
            content: `<@${interaction.user.id}>님의 프롬프트 정보 등록이 완료되었습니다.
  프롬프트: \`\`\`${interaction.fields.getTextInputValue("user_message")}\`\`\`
  시간: ${cronTime || "없음"}
  
  프롬프트 정보 등록이 완료되었습니다. 정해진 시간에 매매가 진행됩니다. 혹은 '진짜트레이딩할래!'나 '테스트트레이딩할래!'를 입력해주세요.
  `,
          });

        } catch (error: any) {
          console.error(error);
          await interaction.reply({
            content: error.message ?? "알 수 없는 오류가 발생했습니다.",
            ephemeral: true,
          });
        }
      }
    }
  } catch (error: any) {
    console.error(error);
  }
});

process.on("unhandledRejection", (error) => {
  console.error(error);
});

discordClient.login(process.env.DISCORD_BOT_TOKEN);

