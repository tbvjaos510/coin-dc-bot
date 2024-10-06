import cron from "node-cron";
import { tradingController, userController } from "../controllers";
import { ChannelType, Client, PublicThreadChannel } from "discord.js";
import { prettyMyAccount } from "../tools/upbit-account";

class TradingCron {
  private crons: Record<string, {
    tradeIds: string[];
    task: cron.ScheduledTask;
  }> = {};

  private client!: Client;

  async init(client: Client) {
    this.client = client;
    await tradingController.getAllTradeInfo().then((tradeInfos) => {
      for (const tradeInfo of tradeInfos) {
        if (tradeInfo.cronTime) {
          this.addTradeCron(tradeInfo._id, tradeInfo.cronTime);
        }
      }
      console.log("init cron success count=" + Object.keys(this.crons).length);
      // const first = Object.values(this.crons)[0];
      //
      // setTimeout(() => {
      //   first.task.now();
      // }, 3000)
    });
  }

  addTradeCron(tradeId: string, cronTime: string) {
    this.crons[cronTime] = this.crons[cronTime] || {
      tradeIds: [],
      task: this.startCron(cronTime),
    };

    this.crons[cronTime].tradeIds.push(tradeId);
  }

  removeTradeCron(tradeId: string, cronTime: string) {
    this.crons[cronTime].tradeIds = this.crons[cronTime]?.tradeIds.filter((id) => id !== tradeId) || [];

    if (this.crons[cronTime].tradeIds.length === 0) {
      this.crons[cronTime].task.stop();
      delete this.crons[cronTime];
    }
  }

  private startCron(cronTime: string) {
    const task = cron.schedule(cronTime, async () => {
      const { tradeIds } = this.crons[cronTime];
      console.log('task start', cronTime, tradeIds);
      const channelIds: Record<string, PublicThreadChannel> = {};

      for (const tradeId of tradeIds) {
        const tradeInfo = await tradingController.getTradeById(tradeId);

        if (!tradeInfo) {
          continue;
        }

        if (tradeInfo.cronTime !== cronTime) {
          this.removeTradeCron(tradeId, cronTime);
          if (tradeInfo.cronTime) {
            this.addTradeCron(tradeId, tradeInfo.cronTime);
          }
          continue;
        }

        const user = await userController.getUser(tradeInfo.userId);

        if (!user) {
          continue;
        }
        console.log(1);

        if (!channelIds[user.channelId]) {
          const channel = await this.client.channels.fetch(user.channelId);

          if (channel?.type === ChannelType.GuildText) {
            const thread = await channel.threads.create({
              name: `트레이딩 ${getCurrentHourHumanReadable()}`,
              type: ChannelType.PublicThread,
              autoArchiveDuration: 1440,
            });

            channelIds[user.channelId] = thread as PublicThreadChannel;
          }
        }
        console.log(channelIds);

        const thread = channelIds[user.channelId]!;

        const message = await thread.send(`${user.nickname}님의 트레이딩이 실행되었습니다.`);

        try {
          const { lastMessageContent, account } = await tradingController.executeTrading(tradeId, false);

          await message.edit({
            content: lastMessageContent + await prettyMyAccount(account) + ` <@${user.userId}>`,
          });
        } catch (error: any) {
          await message.edit({
            content: (error.message ?? "알 수 없는 오류가 발생했습니다.") + ` <@${user.userId}>`,
          });
        }
      }
    }, {
      timezone: "Asia/Seoul",
    });

    task.start();

    return task;
  }
}

const getCurrentHourHumanReadable = () => {
  const now = new Date();

  return `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()} ${now.getHours()}시`;
};

export const tradingCron = new TradingCron();
