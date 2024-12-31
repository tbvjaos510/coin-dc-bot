import { AiTrading, IAITrading } from "../models/ai-tradings";
import { User } from "../models/users";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { communityTools } from "../tools/community";
import { StructuredTool } from "@langchain/core/tools";
import { ExtendedExchangeService } from "../containers/upbit-extended/exchange-service";
import { getUpbitTools } from "../tools/upbit-account";
import { MockExchangeService } from "../containers/upbit-extended/mock-exchange-service";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { SYSTEM_PROMPT } from "../constants/prompt";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { MODELS } from "../constants/model";

export class TradingService {
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

    let model: BaseChatModel;

    switch (tradeInfo.model) {
      case MODELS.GPT:
        model = new ChatOpenAI({
          model: "gpt-4o-mini",
        });
        break;
      case MODELS.CLAUDE:
        model = new ChatAnthropic({
          model: "claude-3-5-haiku-20241022",
          apiKey: process.env.ANTHROPIC_API_KEY!,
        });
        break;
      case MODELS.DEEP_SEEK:
        model = new ChatOpenAI({
          configuration: {
            baseURL: "https://api.deepseek.com",
            apiKey: process.env.DEEP_SEEK_API_KEY!,
          },
          model: "deepseek-chat",
        });
        break;
      default:
        throw new Error("해당하는 모델을 찾을 수 없습니다.");
    }

    const agent = createReactAgent({
      llm: model,
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
      recursionLimit: 35,
    });

    let lastMessages: any[] = [];

    try {
      for await (const { messages } of stream) {
        lastMessages = messages;
      }
    } finally {
      await AiTrading.updateOne({
        _id: tradeId,
      }, {
        $set: {
          lastMessages,
        },
      });
    }

    return {
      history: lastMessages,
      lastMessageContent: lastMessages[lastMessages.length - 1].content!,
      account: await exchangeService.getAllAccount(),
    };
  }

  async upsertTradeInfoByUserId(userId: string, tradeInfo: Partial<IAITrading>) {
    await AiTrading.updateOne({
      userId,
    }, {
      $set: tradeInfo,
    }, {
      upsert: true,
    });

    return this.getTradeByUserId(userId);
  }

  async removeTradeInfoByUserId(userId: string) {
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
