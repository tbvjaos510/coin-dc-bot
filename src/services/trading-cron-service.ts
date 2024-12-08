import cron from "node-cron";
import { ChannelType, Client, PublicThreadChannel } from "discord.js";
import { prettyMyAccount } from "../tools/upbit-account";
import { Logger } from "../utils/logger";
import AsyncLock from "async-lock";
import { UserService } from "./user-service";
import { TradingService } from "./trading-service";

export class TradingCronService {
  constructor(
    private userService: UserService,
    private tradingService: TradingService,
  ) {
  }

  private crons: Record<string, {
    tradeIds: string[];
    task: cron.ScheduledTask;
  }> = {};

  private client!: Client;
  private lock = new AsyncLock();

  async init(client: Client) {
    this.client = client;
    await this.tradingService.getAllTradeInfo().then((tradeInfos) => {
      for (const tradeInfo of tradeInfos) {
        if (tradeInfo.cronTime) {
          this.addTradeCron(tradeInfo._id.toString(), tradeInfo.cronTime);
        }
      }
      Logger.info("init cron success count=" + Object.keys(this.crons).length);
    });

    if (process.env.NODE_ENV !== "test") {
      this.startTradeRankCron();
    }
  }

  public async removeTradeCronByUserId(userId: string) {
    const tradeInfo = await this.tradingService.getTradeByUserId(userId);

    if (tradeInfo && tradeInfo.cronTime && this.crons[tradeInfo.cronTime]) {
      this.removeTradeCron(tradeInfo._id.toString(), tradeInfo.cronTime);
    }
  }

  private removeTradeCron(tradeId: string, cronTime: string) {
    this.crons[cronTime].tradeIds = this.crons[cronTime]?.tradeIds.filter((id) => id !== tradeId) || [];

    if (this.crons[cronTime].tradeIds.length === 0) {
      this.crons[cronTime].task.stop();
      delete this.crons[cronTime];
    }
  }

  validateCronTime(cronTime: string) {
    return cron.validate(cronTime);
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

  getTradingCronsByCronTime(cronTime: string) {
    return this.crons[cronTime];
  }

  private startTradeRankCron() {
    cron.schedule("0 0 * * *", async () => {
      const channels = await this.userService.getTradeUserChannels();

      for (const channelId of channels) {
        const trades = await this.userService.getTradingList(channelId);

        const message = await this.client.channels.fetch(channelId);

        if (message?.type === ChannelType.GuildText) {
          await message.send(`*트레이딩 순위*\n\n${trades.map((trade, index) => `${index + 1}위: <@${trade.user.userId}> - 수익율 ${trade.rate}% (${trade.totalBalance}원)`).join("\n")}`);
        }
      }
    }, {
      timezone: "Asia/Seoul",
      name: "tradeRankCron",
      scheduled: true
    });
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
        const tradeInfo = await this.tradingService.getTradeById(tradeId);

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

        const user = await this.userService.getUser(tradeInfo.userId);

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
          const { lastMessageContent, account } = await this.tradingService.executeTrading(tradeId, false);

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
      name: `tradeCron-${cronTime}`,
      scheduled: true,
    });

    return task;
  }
}
