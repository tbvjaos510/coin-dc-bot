import { IUser, User } from "../models/users";
import { ExtendedExchangeService } from "../containers/upbit-extended/exchange-service";
import { prettyMyAccount } from "../tools/upbit-account";

export class UserController {
  async getUser(id: string): Promise<IUser | null> {
    const user = await User.findOne({
      userId: id,
    });

    if (!user) {
      return null;
    }

    return user.toObject();
  }

  async upsertUser(user: Partial<IUser>) {
    if (user.upbitApiKey || user.upbitSecretKey) {
      const exchangeService = new ExtendedExchangeService(user.upbitApiKey || "", user.upbitSecretKey || "");

      try {
        const account = await exchangeService.getAllAccount();

        if (!account) {
          throw "not found";
        }
      } catch (error) {
        throw new Error("API 키가 올바르지 않거나 허용 IP가 등록되지 않았습니다.");
      }
    }

    await User.updateOne(
      {
        userId: user.userId,
      },
      {
        $set: user,
      },
      {
        upsert: true,
      },
    );
  }

  async deleteUser(id: string) {
    await User.deleteOne({
      userId: id,
    });
  }

  async getTradeUserChannels() {
    return User.find({
      upbitApiKey: { $ne: null },
      upbitSecretKey: { $ne: null },
    }).distinct("channelId");
  }

  async getTradingList(channelId: string) {
    const users = await User.find({
      channelId,
      upbitApiKey: { $ne: null },
      upbitSecretKey: { $ne: null },
    }).lean();

    return Promise.all(users.map(async user => {
      const exchangeService = new ExtendedExchangeService(user.upbitApiKey!, user.upbitSecretKey!);

      const account = await exchangeService.getAllAccount();

      const totalBalance = (await prettyMyAccount(account)).total_balance || user.initialBalance

      return {
        user,
        totalBalance,
        initialPrice: user.initialBalance,
        rate: Math.floor((totalBalance / user.initialBalance) * 100) - 100,
      }
    })).then(result => result.sort((a, b) => b.rate - a.rate));
  }
}
