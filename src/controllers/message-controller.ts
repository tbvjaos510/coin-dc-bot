import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Message } from "discord.js";
import { UserService } from "../services/user-service";
import { TradingService } from "../services/trading-service";
import { prettyMyAccount } from "../tools/upbit-account";
import { Logger } from "../utils/logger";

export class MessageController {
  constructor(private userService: UserService, private tradingService: TradingService) {
  }

  async startTradingGuide(message: Message) {
    const buttonGroup = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("open_user_setting_modal").setLabel("유저 정보 등록").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("open_prompt_setting_modal").setLabel("프롬프트 정보 등록").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("remove_user_setting").setLabel("유저 & 프롬프트 정보 삭제").setStyle(ButtonStyle.Danger),
    );

    await message.reply({
      content: "매매를 위해 필요한 정보를 등록해주세요.\n유저 정보 등록을 먼저 한 후, 프롬프트 정보 등록을 해주세요.",
      components: [buttonGroup],
    });
  }

  async executeTrading(message: Message, { isTest }: { isTest: boolean }) {
    const user = await this.userService.getUser(message.author.id);
    if (!user) {
      await message.reply("유저 정보를 먼저 등록해주세요. (채팅에 '트레이딩시작할래!'를 입력해주세요.)");
      return;
    }

    const prompt = await this.tradingService.getTradeByUserId(message.author.id);
    if (!prompt) {
      await message.reply("프롬프트 정보를 먼저 등록해주세요. (채팅에 '트레이딩시작할래!'를 입력해주세요.)");
      return;
    }

    const reply = await message.reply("트레이딩 진행중... 약 1분정도 소요됩니다.");
    try {
      const { lastMessageContent, account, history } = await this.tradingService.executeTrading(prompt._id, isTest);
      await reply.edit({
        content: lastMessageContent + (await prettyMyAccount(account)).message,
        files: [{ name: "trading-history.txt", attachment: Buffer.from(JSON.stringify(history, null, 2)) }],
      });
    } catch (error: any) {
      Logger.error(error);
      await reply.edit("오류가 발생했습니다.");
    }
  }

  async getInvestmentInfo(message: Message) {
    const targetUserId = message.mentions.users.first()?.id || message.author.id;
    const account = await this.tradingService.getTradeAccount(targetUserId);
    if (!account) {
      await message.reply("해당 유저의 정보가 없습니다.");
      return;
    }
    const prettyAccount = await prettyMyAccount(account);
    await message.reply(`<@${targetUserId}>님의 계좌 정보입니다.\n${prettyAccount.message}`);
  }
}
