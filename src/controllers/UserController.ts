import { IUser, User } from "../models/users";
import { ExtendedExchangeService } from "../containers/upbit-extended/exchange-service";

export class UserController {
  async getUser(id: string): Promise<IUser | null> {
    const user = await User.findOne({
      userId: id,
    });

    if (!user) {
      return null;
    }

    return user.toObject()
  }

  async upsertUser(user: Partial<IUser>) {
    if (user.upbitApiKey ||user.upbitSecretKey) {
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
      }
    );
  }

  async deleteUser(id: string) {
    await User.deleteOne({
      userId: id,
    });
  }
}
