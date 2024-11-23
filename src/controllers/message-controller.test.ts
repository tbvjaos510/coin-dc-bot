import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MessageController } from "../controllers/message-controller";
import { UserService } from "../services/user-service";
import { TradingService } from "../services/trading-service";
import { Collection, Message } from "discord.js";
import { User } from "../models/users";
import { AiTrading } from "../models/ai-tradings";
import { ExtendedExchangeService } from "../containers/upbit-extended/exchange-service";

describe("MessageController Unit Tests", () => {
  let messageController: MessageController;
  let userService: UserService;
  let tradingService: TradingService;
  let originalExecuteTrading: any;
  let originalGetTradeAccount: any;

  beforeEach(() => {
    userService = new UserService();
    tradingService = new TradingService();
    tradingService.executeTrading = vi.fn();
    messageController = new MessageController(userService, tradingService);
    originalExecuteTrading = tradingService.executeTrading;
    originalGetTradeAccount = tradingService.getTradeAccount;

    ExtendedExchangeService.prototype.getAllAccount = vi.fn().mockResolvedValue([
      {
        currency: "KRW",
        balance: "1000000",
        locked: "0",
        avg_buy_price: "0",
        avg_buy_price_modified: true,
        unit_currency: "KRW",
      },
      {
        currency: "BTC",
        balance: "0.1",
        locked: "0",
        avg_buy_price: "50000000",
        avg_buy_price_modified: false,
        unit_currency: "KRW",
      },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    tradingService.executeTrading = originalExecuteTrading;
    tradingService.getTradeAccount = originalGetTradeAccount;
  });

  describe("startTradingGuide", () => {
    it("should send a message with buttons to register user and prompt settings", async () => {
      const message = {
        reply: vi.fn(),
      } as unknown as Message;

      await messageController.startTradingGuide(message);

      expect(message.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "매매를 위해 필요한 정보를 등록해주세요.\n유저 정보 등록을 먼저 한 후, 프롬프트 정보 등록을 해주세요.",
          components: expect.any(Array),
        }),
      );
    });
  });

  describe("executeTrading", () => {
    it("should reply with an error if user is not registered", async () => {
      const message = {
        author: { id: "test_user_id" },
        reply: vi.fn(),
      } as unknown as Message;

      await messageController.executeTrading(message, { isTest: true });

      expect(message.reply).toHaveBeenCalledWith(
        "유저 정보를 먼저 등록해주세요. (채팅에 '트레이딩시작할래!'를 입력해주세요.)",
      );
    });

    it("should reply with an error if prompt is not registered", async () => {
      await new User({
        userId: "test_user_id",
        serverId: "test_server_id",
        channelId: "test_channel_id",
        nickname: "test_nickname",
        initialBalance: 1000,
      }).save();

      const message = {
        author: { id: "test_user_id" },
        reply: vi.fn(),
      } as unknown as Message;

      await messageController.executeTrading(message, { isTest: true });

      expect(message.reply).toHaveBeenCalledWith(
        "프롬프트 정보를 먼저 등록해주세요. (채팅에 '트레이딩시작할래!'를 입력해주세요.)",
      );
    });

    it("should execute trading and edit the reply with the result", async () => {
      await new User({
        userId: "test_user_id",
        serverId: "test_server_id",
        channelId: "test_channel_id",
        nickname: "test_nickname",
        initialBalance: 1000,
      }).save();

      await new AiTrading({
        userId: "test_user_id",
        userMessage: "테스트 메시지",
      }).save();

      const editFn = vi.fn();

      const message = {
        author: { id: "test_user_id" },
        reply: vi.fn().mockResolvedValue({ edit: editFn }),
      } as unknown as Message;

      tradingService.executeTrading = vi.fn().mockResolvedValue({
        lastMessageContent: "트레이딩 결과",
        account: [],
        history: [],
      });

      await messageController.executeTrading(message, { isTest: true });

      expect(tradingService.executeTrading).toHaveBeenCalledWith(expect.anything(), true);
      expect(message.reply).toHaveBeenCalledWith("트레이딩 진행중... 약 1분정도 소요됩니다.");
      expect(editFn).toHaveBeenCalledWith(expect.objectContaining({
        content: expect.stringContaining("트레이딩 결과\n총 자산"),
        files: expect.any(Array),
      }));
    });

    it("should handle error during trading execution", async () => {
      await new User({
        userId: "test_user_id",
        serverId: "test_server_id",
        channelId: "test_channel_id",
        nickname: "test_nickname",
        initialBalance: 1000,
      }).save();

      await new AiTrading({
        userId: "test_user_id",
        userMessage: "테스트 메시지",
      }).save();

      const editFn = vi.fn();

      const message = {
        author: { id: "test_user_id" },
        reply: vi.fn().mockResolvedValue({ edit: editFn }),
      } as unknown as Message;

      tradingService.executeTrading = vi.fn().mockRejectedValue(new Error("트레이딩 오류"));

      await messageController.executeTrading(message, { isTest: true });

      expect(tradingService.executeTrading).toHaveBeenCalledWith(expect.anything(), true);
      expect(message.reply).toHaveBeenCalledWith("트레이딩 진행중... 약 1분정도 소요됩니다.");
      expect(editFn).toHaveBeenCalledWith("오류가 발생했습니다.");
    });
  });

  describe("getInvestmentInfo", () => {
    it("should reply with user account information", async () => {
      const message = {
        author: { id: "test_user_id" },
        mentions: {
          users: new Collection([["test_user_id", { id: "test_user_id" }]]),
        },
        reply: vi.fn(),
      } as unknown as Message;

      await new User({
        userId: "test_user_id",
        serverId: "test_server_id",
        channelId: "test_channel_id",
        nickname: "test_nickname",
        upbitApiKey: "test_api_key",
        upbitSecretKey: "test_secret_key",
        initialBalance: 1000,
      }).save();

      await messageController.getInvestmentInfo(message);

      expect(message.reply).toHaveBeenCalledWith(
        expect.stringContaining("님의 계좌 정보입니다."),
      );

      expect(message.reply).toHaveBeenCalledWith(
        expect.stringContaining("현재 원화 계좌 잔고: 1,000,000원"),
      );
    });

    it("should reply with an error if user account information is not found", async () => {
      const message = {
        author: { id: "test_user_id" },
        mentions: {
          users: new Collection([["test_user_id", { id: "test_user_id" }]]),
        },
        reply: vi.fn(),
      } as unknown as Message;

      tradingService.getTradeAccount = vi.fn().mockResolvedValue(null);

      await messageController.getInvestmentInfo(message);

      expect(message.reply).toHaveBeenCalledWith("해당 유저의 정보가 없습니다.");
    });
  });
});
