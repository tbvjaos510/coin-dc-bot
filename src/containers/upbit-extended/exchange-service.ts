import { ExchangeService } from "node-upbit";

export interface OrderResult {
  uuid: string;
  price: string;
  state: "wait" | "done" | "cancel";
  market: string;
  volume: string;
  executed_volume: string;
  executed_funds: string;
}

export class ExtendedExchangeService extends ExchangeService {
  async sellOrder({ coin, volume }: { coin: string; volume: number }) {
    const result = await this.getAuthParamData<OrderResult>({
      method: "POST",
      url: "https://api.upbit.com/v1/orders",
      params: {
        market: coin,
        volume,
        side: "ask",
        ord_type: "market",
      },
    }).then(({ data }) => data).catch(this.catchError);

    return this.waitOrderByUuid(result.uuid);
  }

  async buyOrder({ coin, price }: { coin: string; price: number }) {
    const result = await this.getAuthParamData<OrderResult>({
      method: "POST",
      url: "https://api.upbit.com/v1/orders",
      params: {
        market: coin,
        price,
        side: "bid",
        ord_type: "price",
      },
    }).then(({ data }) => data).catch(this.catchError);

    return this.waitOrderByUuid(result.uuid);
  }

  async waitOrderByUuid(uuid: string): Promise<OrderResult> {
    const result = await this.getAuthParamData<OrderResult[]>({
      method: "GET",
      url: "https://api.upbit.com/v1/orders/uuids",
      params: {
        "uuids": [uuid],
      },
    }).then(({ data }) => data[0] || data).catch(this.catchError);

    if (result.state === "wait") {
      return new Promise((resolve) => setTimeout(() => resolve(this.waitOrderByUuid(uuid)), 1000));
    }

    return result;
  }

  catchError(error: any): never {
    if (error?.response?.data?.error?.message) {
      console.log(error.response.data.error);
      throw new Error(error.response.data.error.message);
    }

    throw error;
  }
}
