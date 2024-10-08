import cron from "node-cron";
import { tradingController, userController } from "../controllers";
import { ChannelType, Client, PublicThreadChannel } from "discord.js";
import { prettyMyAccount } from "../tools/upbit-account";
import { Logger } from "../utils/logger";
import AsyncLock from "async-lock";

class TradingCron {
  private crons: Record<string, {
    tradeIds: string[];
    task: cron.ScheduledTask;
  }> = {};

  private client!: Client;
  private lock = new AsyncLock();

  async init(client: Client) {
    this.client = client;
    await tradingController.getAllTradeInfo().then((tradeInfos) => {
      for (const tradeInfo of tradeInfos) {
        if (tradeInfo.cronTime) {
          this.addTradeCron(tradeInfo._id.toString(), tradeInfo.cronTime);
        }
      }
      Logger.info("init cron success count=" + Object.keys(this.crons).length);
      // const first = Object.values(this.crons)[0];
      //
      // setTimeout(() => {
      //   first.task.now();
      // }, 3000)
    });

    this.startTradeRankCron();
  }

  addTradeCron(tradeId: string, cronTime: string) {
    this.crons[cronTime] = this.crons[cronTime] || {
      tradeIds: [],
      task: this.startCron(cronTime),
    };

    if (this.crons[cronTime].tradeIds.includes(tradeId.toString())) {
      return;
    }

    this.crons[cronTime].tradeIds.push(tradeId.toString());
  }

  removeTradeCron(tradeId: string, cronTime: string) {
    this.crons[cronTime].tradeIds = this.crons[cronTime]?.tradeIds.filter((id) => id !== tradeId) || [];

    if (this.crons[cronTime].tradeIds.length === 0) {
      this.crons[cronTime].task.stop();
      delete this.crons[cronTime];
    }
  }

  private startTradeRankCron() {
    const task = cron.schedule("0 0 * * *", async () => {
      const channels = await userController.getTradeUserChannels();

      for (const channelId of channels) {
        const trades = await userController.getTradingList(channelId);

        const message = await this.client.channels.fetch(channelId);

        if (message?.type === ChannelType.GuildText) {
          await message.send(`*트레이딩 순위*\n\n${trades.map((trade, index) => `${index + 1}위: <@${trade.user.userId}> - 수익율 ${trade.rate}% (${trade.totalBalance}원)`).join("\n")}`);
        }

      }
    }, {
      timezone: "Asia/Seoul",
    });

    task.start();
  }

  private startCron(cronTime: string) {
    const task = cron.schedule(cronTime, async () => {
      const { tradeIds } = this.crons[cronTime];
      Logger.info("task start", cronTime, tradeIds);
      const channelIds: Record<string, PublicThreadChannel> = {};
      const today = new Date().toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
        dateStyle: "full",
      });

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

        await this.lock.acquire(user.channelId, async () => {
          if (!channelIds[user.channelId]) {
            const channel = await this.client.channels.fetch(user.channelId);

            if (channel?.type === ChannelType.GuildText) {
              const existingThread = (await channel.threads.fetchActive()).threads.find(thread => thread.name.includes(today));

              if (existingThread) {
                channelIds[user.channelId] = existingThread as PublicThreadChannel;
              } else {
                const thread = await channel.threads.create({
                  name: `트레이딩 ${today}`,
                  type: ChannelType.PublicThread,
                  autoArchiveDuration: 1440,
                });

                channelIds[user.channelId] = thread as PublicThreadChannel;
              }
            }
          }
        });
        const thread = channelIds[user.channelId]!;

        const message = await thread.send(`${user.nickname}님의 트레이딩이 실행되었습니다.`);

        try {
          const { lastMessageContent, account } = await tradingController.executeTrading(tradeId, false);

          await message.edit({
            content: lastMessageContent + (await prettyMyAccount(account)).message + ` <@${user.userId}>`,
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

export const tradingCron = new TradingCron();
