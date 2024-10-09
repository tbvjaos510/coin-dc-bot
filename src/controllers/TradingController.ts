import { AiTrading, IAITrading } from "../models/ai-tradings";
import { IUser, User } from "../models/users";
import { ChatOpenAI } from "@langchain/openai";
import { communityTools } from "../tools/community";
import { StructuredTool } from "@langchain/core/tools";
import { ExtendedExchangeService } from "../containers/upbit-extended/exchange-service";
import { getUpbitTools } from "../tools/upbit-account";
import { MockExchangeService } from "../containers/upbit-extended/mock-exchange-service";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tradingCron } from "../containers/cron";
import { SYSTEM_PROMPT } from "../constants/prompt";


export class TradingController {
  private model = new ChatOpenAI({
    model: "gpt-4o-mini",
  });

  async executeTrading(tradeId: string, isTest: boolean) {
    const tradeInfo = await AiTrading.findById(tradeId);

    if (!tradeInfo) {
      throw new Error("해당하는 거래 정보를 찾을 수 없습니다.");
    }

    const user = await User.findOne({
      userId: tradeInfo.userId,
    });

    if (!user) {
      throw new Error("해당하는 사용자를 찾을 수 없습니다.");
    }

    const tools: StructuredTool<any>[] = [...communityTools];
    let exchangeService: ExtendedExchangeService;

    if (isTest) {
      exchangeService = new MockExchangeService();
    } else {
      if (!user.upbitApiKey || !user.upbitSecretKey) {
        throw new Error("업비트 API 키가 등록되지 않았습니다.");
      }
      exchangeService = new ExtendedExchangeService(user.upbitApiKey, user.upbitSecretKey);
    }
    tools.push(...getUpbitTools(exchangeService));

    const agent = createReactAgent({
      llm: this.model,
      tools,
      messageModifier: SYSTEM_PROMPT,
    });

    const inputs = {
      messages: [
        {
          role: "user", content: tradeInfo.userMessage,
        },
      ],
    };

    const stream = await agent.stream(inputs, {
      streamMode: "values",
    });

    const history: {
      type: "message" | "tool_call",
      content?: string,
      tool?: any
    }[] = [];

    for await (const { messages } of stream) {
      const lastMessage = messages[messages.length - 1];

      if (lastMessage.content) {
        history.push({
          type: "message",
          content: lastMessage.content,
        });
      } else if (lastMessage.tool_calls?.length > 0) {
        const tools = lastMessage.tool_calls;

        for (const tool of tools) {
          history.push({
            type: "tool_call",
            tool,
          });
        }
      }
    }

    tradeInfo.lastMessages = history;

    await tradeInfo.save();

    return {
      history,
      lastMessageContent: history[history.length - 1].content!,
      account: await exchangeService.getAllAccount(),
    };
  }

  async upsertTradeInfo(userId: string, trade: Partial<IAITrading>) {
    const exitingTrade = await AiTrading.findOne({
      userId,
    });

    if (exitingTrade && exitingTrade.cronTime) {
      tradingCron.removeTradeCron(exitingTrade._id, exitingTrade.cronTime);
    }

    const result = await AiTrading.updateOne({
      userId,
    }, {
      $set: trade,
    }, {
      upsert: true,
    });

    if (exitingTrade?.cronTime) {
      tradingCron.removeTradeCron((result.upsertedId?.toString() || exitingTrade._id?.toString())!, exitingTrade.cronTime);
    }

    if ((result.upsertedId || exitingTrade) && trade.cronTime) {
      tradingCron.addTradeCron((result.upsertedId?.toString() || exitingTrade?._id?.toString())!, trade.cronTime);
    }
  }

  async removeTradeInfo(userId: string) {
    const tradeInfo = await AiTrading.findOne({
      userId,
    });

    if (tradeInfo && tradeInfo.cronTime) {
      tradingCron.removeTradeCron(tradeInfo._id, tradeInfo.cronTime);
    }

    await AiTrading.deleteOne({
      userId,
    });
  }

  async getTradeByUserId(userId: string) {
    const tradeInfo = await AiTrading.findOne({
      userId,
    });

    if (!tradeInfo) {
      return null;
    }

    return tradeInfo.toObject();
  }

  async getTradeAccount(userId: string) {
    const user = await User.findOne({
      userId: userId,
    });

    if (!user || !user.upbitApiKey || !user.upbitSecretKey) {
      return null;
    }

    const exchangeService = new ExtendedExchangeService(user.upbitApiKey!, user.upbitSecretKey!);

    const account = await exchangeService.getAllAccount();

    return account;
  }

  async getTradeById(tradeId: string) {
    const tradeInfo = await AiTrading.findById(tradeId);

    if (!tradeInfo) {
      return null;
    }

    return tradeInfo.toObject();
  }

  async getAllTradeInfo() {
    const tradeInfo = await AiTrading.find();

    if (!tradeInfo) {
      return [];
    }

    return tradeInfo.map((trade) => trade.toObject());
  }
}












