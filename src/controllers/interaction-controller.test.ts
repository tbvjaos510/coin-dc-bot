import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractionController } from "./interaction-controller";
import { UserService } from "../services/user-service";
import { TradingService } from "../services/trading-service";
import { TradingCronService } from "../services/trading-cron-service";
import { ButtonInteraction, ModalSubmitInteraction } from "discord.js";
import { AiTrading } from "../models/ai-tradings";
import { User } from "../models/users";
import { ExtendedExchangeService } from "../containers/upbit-extended/exchange-service";

describe("InteractionController Unit Tests", () => {
  let interactionController: InteractionController;
  let userService: UserService;
  let tradingService: TradingService;
  let tradingCronService: TradingCronService;

  beforeEach(() => {
    userService = new UserService();
    tradingService = new TradingService();
    tradingService.executeTrading = vi.fn();
    tradingCronService = new TradingCronService(userService, tradingService);

    interactionController = new InteractionController(userService, tradingService, tradingCronService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("openUserSettingModal", () => {
    it("should open user setting modal", async () => {
      const interaction = {
        user: { id: "test_user_id" },
        showModal: vi.fn(),
      } as unknown as ButtonInteraction;

      await new User({
        userId: "test_user_id",
        serverId: "test_server_id",
        channelId: "test_channel_id",
        nickname: "test_nickname",
        initialBalance: 1000,
      }).save();

      await interactionController.openUserSettingModal(interaction);

      expect(interaction.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.arrayContaining([
            expect.objectContaining({
              components: [
                expect.objectContaining({ custom_id: "upbit_access_key" }),
              ],
            }),
            expect.objectContaining({
              components: [
                expect.objectContaining({ custom_id: "upbit_secret_key" }),
              ],
            }),
            expect.objectContaining({
              components: [
                expect.objectContaining({ custom_id: "initial_balance" }),
              ],
            }),
          ]),
        }),
      );
    });
  });

  describe("openPromptSettingModal", () => {
    it("should open prompt setting modal", async () => {
      const interaction = {
        user: { id: "test_user_id" },
        reply: vi.fn(),
        showModal: vi.fn(),
      } as unknown as ButtonInteraction;

      await new User({
        userId: "test_user_id",
        serverId: "test_server_id",
        channelId: "test_channel_id",
        nickname: "test_nickname",
        initialBalance: 1000,
      }).save();

      await interactionController.openPromptSettingModal(interaction);

      expect(interaction.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.arrayContaining([
            expect.objectContaining({
              components: [
                expect.objectContaining({ custom_id: "user_message" }),
              ],
            }),
            expect.objectContaining({
              components: [
                expect.objectContaining({ custom_id: "cron" }),
              ],
            }),
          ]),
        }),
      );
    });

    it("should open prompt setting modal with filled form", async () => {
      const interaction = {
        user: { id: "test_user_id" },
        reply: vi.fn(),
        showModal: vi.fn(),
      } as unknown as ButtonInteraction;

      await new User({
        userId: "test_user_id",
        serverId: "test_server_id",
        channelId: "test_channel_id",
        nickname: "test_nickname",
        initialBalance: 1000,
      }).save();

      await new AiTrading({
        userId: "test_user_id",
        userMessage: "test_message",
        cronTime: "0 0 1,2,3 * * *",
        model: "gpt",
      }).save();

      await interactionController.openPromptSettingModal(interaction);

      expect(interaction.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.arrayContaining([
            expect.objectContaining({
              components: [
                expect.objectContaining({ custom_id: "user_message", value: "test_message" }),
              ],
            }),
            expect.objectContaining({
              components: [
                expect.objectContaining({ custom_id: "cron", value: "1,2,3" }),
              ],
            }),
          ]),
        }),
      );
    });

    it("should handle error when user is not registered", async () => {
      const interaction = {
        user: { id: "non_existent_user_id" },
        reply: vi.fn(),
        showModal: vi.fn(),
      } as unknown as ButtonInteraction;

      await interactionController.openPromptSettingModal(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: "유저 정보를 먼저 등록해주세요.",
        ephemeral: true,
      });
    });
  });

  describe("removeUserSetting", () => {
    it("should delete user settings and remove associated trade information", async () => {
      const interaction = {
        customId: "remove_user_setting",
        user: { id: "test_user_id" },
        reply: vi.fn(),
      } as unknown as ButtonInteraction;

      await new User({
        userId: "test_user_id",
        serverId: "test_server_id",
        channelId: "test_channel_id",
        nickname: "test_nickname",
        initialBalance: 1000,
      }).save();

      const trading = await new AiTrading({
        userId: "test_user_id",
        userMessage: "test_message",
        cronTime: "0 0 * * *",
        model: "gpt",
      }).save();

      tradingCronService.addTradeCron(trading._id.toString(), "0 0 * * *");

      await interactionController.removeUserSetting(interaction);

      expect(await User.findOne({ userId: "test_user_id" })).toBeNull();
      expect(await AiTrading.findOne({ userId: "test_user_id" })).toBeNull();
      expect(tradingCronService.getTradingCronsByCronTime("0 0 * * *")).toBeUndefined();
      expect(interaction.reply).toHaveBeenCalledWith({
        content: "유저 정보 삭제가 완료되었습니다.",
        ephemeral: true,
      });
    });

    it("should handle error when deleting user settings", async () => {
      const interaction = {
        customId: "remove_user_setting",
        user: { id: "non_existent_user_id" },
        reply: vi.fn(),
      } as unknown as ButtonInteraction;

      await interactionController.removeUserSetting(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: "유저 정보가 없습니다.",
        ephemeral: true,
      });
    });
  });

  describe("submitUserSettingModal", () => {
    let interaction: ModalSubmitInteraction;
    beforeEach(() => {
      interaction = {
        customId: "user_setting_modal",
        user: { id: "test_user_id", username: "test_username" },
        guildId: "test_guild_id",
        channelId: "test_channel_id",
        fields: {},
        reply: vi.fn(),
      } as unknown as ModalSubmitInteraction;

    });

    it("should upsert user when not passed upbit info", async () => {
      interaction.fields.getTextInputValue = vi.fn().mockImplementation((field) => {
        if (field === "agree") return "동의함";
        if (field === "upbit_access_key") return "";
        if (field === "upbit_secret_key") return "";
        if (field === "initial_balance") return "1000";
        return "";
      });

      await interactionController.submitUserSettingModal(interaction);

      const user = await User.findOne({ userId: "test_user_id" });
      expect(user).not.toBeNull();
      expect(user?.nickname).toBe("test_username");
      expect(user?.upbitApiKey).toBeUndefined();
      expect(interaction.reply).toHaveBeenCalledWith({
        content: "유저 정보 등록이 완료되었습니다.",
        ephemeral: true,
      });
    });

    it("should upsert user when passed valid upbit info", async () => {
      interaction.fields.getTextInputValue = vi.fn().mockImplementation((field) => {
        if (field === "agree") return "동의함";
        if (field === "upbit_access_key") return "valid_test_access_key";
        if (field === "upbit_secret_key") return "valid_test_secret_key";
        if (field === "initial_balance") return "1000";
        return "";
      });
      ExtendedExchangeService.prototype.getAllAccount = vi.fn().mockResolvedValue([]);

      await interactionController.submitUserSettingModal(interaction);

      const user = await User.findOne({ userId: "test_user_id" });
      expect(user).not.toBeNull();
      expect(user?.nickname).toBe("test_username");
      expect(user?.upbitApiKey).toBe("valid_test_access_key");
      expect(user?.upbitSecretKey).toBe("valid_test_secret_key");
      expect(interaction.reply).toHaveBeenCalledWith({
        content: "유저 정보 등록이 완료되었습니다.",
        ephemeral: true,
      });
    });

    it("should handle error when passed invalid upbit info", async () => {
      interaction.fields.getTextInputValue = vi.fn().mockImplementation((field) => {
        if (field === "agree") return "동의함";
        if (field === "upbit_access_key") return "invalid_test_access_key";
        if (field === "upbit_secret_key") return "invalid_test_secret_key";
        if (field === "initial_balance") return "1000";
        return "";
      });
      ExtendedExchangeService.prototype.getAllAccount = vi.fn().mockRejectedValue("API 키가 올바르지 않거나 허용 IP가 등록되지 않았습니다.");

      await interactionController.submitUserSettingModal(interaction);

      const user = await User.findOne({ userId: "test_user_id" });
      expect(user).toBeNull();
      expect(interaction.reply).toHaveBeenCalledWith({
        content: "API 키가 올바르지 않거나 허용 IP가 등록되지 않았습니다.",
        ephemeral: true,
      });
    });

    it("should handle error when user does not agree", async () => {
      interaction.fields.getTextInputValue = vi.fn().mockImplementation((field) => {
        if (field === "agree") return "동의안함";
        return "";
      });

      await interactionController.submitUserSettingModal(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: "동의를 하셔야 합니다.",
        ephemeral: true,
      });
    });
  });

  describe("submitPromptSettingModal", () => {
    let interaction: ModalSubmitInteraction;
    beforeEach(() => {
      interaction = {
        customId: "prompt_setting_modal",
        user: { id: "test_user_id", username: "test_username" },
        guildId: "test_guild_id",
        channelId: "test_channel_id",
        fields: {},
        reply: vi.fn(),
      } as unknown as ModalSubmitInteraction;
    });

    it("should insert prompt setting when user is registered", async () => {
      interaction.fields.getTextInputValue = vi.fn().mockImplementation((field) => {
        if (field === "user_message") return "test_message";
        if (field === "cron") return "1,2,3";
        if (field === "model") return "gpt";
        return "";
      });

      await new User({
        userId: "test_user_id",
        serverId: "test_server_id",
        channelId: "test_channel_id",
        nickname: "test_nickname",
        upbitApiKey: "test_api_key",
        upbitSecretKey: "test_secret_key",
        initialBalance: 1000,
      }).save();

      await interactionController.submitPromptSettingModal(interaction);

      const trading = await AiTrading.findOne({ userId: "test_user_id" });
      expect(trading).not.toBeNull();
      expect(trading?.userMessage).toBe("test_message");
      expect(trading?.cronTime).toBe("0 1,2,3 * * *");
      expect(interaction.reply).toHaveBeenCalledWith({
        content: `<@test_user_id>님의 프롬프트 정보 등록이 완료되었습니다.\n프롬프트: \`\`\`test_message\`\`\`\n시간: 0 1,2,3 * * *`,
      });
    });

    it("should update prompt setting when user is registered", async () => {
      interaction.fields.getTextInputValue = vi.fn().mockImplementation((field) => {
        if (field === "user_message") return "test_message";
        if (field === "cron") return "1,2,3";
        if (field === "model") return "claude";
        return "";
      });

      await new User({
        userId: "test_user_id",
        serverId: "test_server_id",
        channelId: "test_channel_id",
        nickname: "test_nickname",
        upbitApiKey: "test_api_key",
        upbitSecretKey: "test_secret_key",
        initialBalance: 1000,
      }).save();

      const exitingTrading = await new AiTrading({
        userId: "test_user_id",
        userMessage: "old_test_message",
        cronTime: "0 0 4,5,6 * * *",
        model: "gpt",
      }).save();

      tradingCronService.addTradeCron(exitingTrading._id.toString(), "0 0 4,5,6 * * *");

      await interactionController.submitPromptSettingModal(interaction);

      const trading = await AiTrading.findOne({ userId: "test_user_id" });

      expect(trading).not.toBeNull();
      expect(trading?.userMessage).toBe("test_message");
      expect(trading?.model).toBe("claude");
      expect(trading?.cronTime).toBe("0 1,2,3 * * *");
      expect(interaction.reply).toHaveBeenCalledWith({
        content: `<@test_user_id>님의 프롬프트 정보 등록이 완료되었습니다.\n프롬프트: \`\`\`test_message\`\`\`\n시간: 0 1,2,3 * * *`,
      });
      expect(tradingCronService.getTradingCronsByCronTime("0 4,5,6 * * *")).toBeUndefined();
      expect(tradingCronService.getTradingCronsByCronTime("0 1,2,3 * * *")).not.toBeUndefined();
    });

    it("should handle error when cron time is invalid", async () => {
      await new User({
        userId: "test_user_id",
        serverId: "test_server_id",
        channelId: "test_channel_id",
        nickname: "test_nickname",
        initialBalance: 1000,
        upbitApiKey: "test_api_key",
        upbitSecretKey: "test_secret_key",
      }).save();

      interaction.fields.getTextInputValue = vi.fn().mockImplementation((field) => {
        if (field === "user_message") return "test_message";
        if (field === "cron") return "invalid_cron";
        return "";
      });

      await interactionController.submitPromptSettingModal(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining("올바른 시간이 아닙니다. 다시 입력해주세요."),
        ephemeral: true,
      });
    });

    it("should handle error when user is not registered", async () => {
      interaction.fields.getTextInputValue = vi.fn().mockImplementation((field) => {
        if (field === "user_message") return "test_message";
        if (field === "cron") return "1,2,3";
        return "";
      });

      await interactionController.submitPromptSettingModal(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining("유저 정보를 먼저 등록해주세요. (채팅에 '트레이딩시작할래!'를 입력해주세요.)"),
        ephemeral: true,
      });
    });
  });
});
