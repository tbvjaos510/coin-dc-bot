import { ExtendedExchangeService, OrderResult } from "./exchange-service";
import { IAccountProps } from "node-upbit/lib/@types/exchange";
import { ExtendedQuoationService } from "./quoation-service";

export class MockExchangeService extends ExtendedExchangeService {
  private account: Record<string, IAccountProps>

  constructor() {
    super("", "");

    this.account = {
      "KRW": {
        currency: "KRW",
        unit_currency: "KRW",
        balance: "500000",
        avg_buy_price: "0",
        avg_buy_price_modified: false,
        locked: "0"
      },
      "KRW-XRP": {
        currency: "XRP",
        unit_currency: "KRW",
        balance: "300",
        avg_buy_price: "800",
        avg_buy_price_modified: false,
        locked: "0"
      },
    };
  }

  getAllAccount(): Promise<IAccountProps[]> {
    return Promise.resolve(Object.values(this.account));
  }

  async buyOrder({ coin, price }: { coin: string; price: number }): Promise<OrderResult> {
    const krwAccount = this.account["KRW"];

    if (parseInt(krwAccount.balance) < price) {
      throw new Error("원화 잔고가 부족합니다.");
    }

    const coinAccount = this.account[coin];

    const currentPrice = await this.getCurrentCoinPrice(coin);

    krwAccount.balance = (parseInt(krwAccount.balance) - price).toString();

    if (coinAccount) {
      coinAccount.balance = (parseInt(coinAccount.balance) + price / currentPrice).toString();
      coinAccount.avg_buy_price = ((parseInt(coinAccount.avg_buy_price) * parseInt(coinAccount.balance) + price) / parseInt(coinAccount.balance)).toString();
    } else {
      this.account[coin] = {
        currency: coin,
        unit_currency: coin,
        balance: (price / currentPrice).toString(),
        avg_buy_price: price.toString(),
        avg_buy_price_modified: false,
        locked: "0"
      };
    }

    return {
      uuid: "uuid",
      state: "done",
      price: price.toString(),
      market: coin,
      volume: (price / currentPrice).toString(),
      executed_volume: (price / currentPrice).toString(),
      executed_funds: price.toString(),
    }
  }

  async sellOrder({ coin, volume }: { coin: string; volume: number }): Promise<OrderResult> {
    const coinAccount = this.account[coin];

    if (!coinAccount || parseInt(coinAccount.balance) < volume) {
      throw new Error("보유량이 부족합니다.");
    }

    const currentPrice = await this.getCurrentCoinPrice(coin);

    coinAccount.balance = (parseInt(coinAccount.balance) - volume).toString();

    this.account["KRW"].balance = (parseInt(this.account["KRW"].balance) + volume * currentPrice).toString();

    return {
      uuid: "uuid",
      state: "done",
      price: currentPrice.toString(),
      market: coin,
      volume: volume.toString(),
      executed_volume: volume.toString(),
      executed_funds: (volume * currentPrice).toString(),
    }
  }

  private async getCurrentCoinPrice(coin: string) {
    const quoationService = new ExtendedQuoationService();

    const [result] = await quoationService.getTicker([coin]);

    return result.trade_price;
  }
}
