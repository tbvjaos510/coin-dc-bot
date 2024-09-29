import { QuoationService } from "node-upbit";
import { ITickerProps } from "node-upbit/lib/@types/quotation";

export class ExtendedQuoationService extends QuoationService {
  async getTickerAll(currencies: string[]) {
    const { data } = await this.getData<ITickerProps[]>({
      method: "GET",
      url: `https://api.upbit.com/v1/ticker/all?quoteCurrencies=${currencies.join(",")}`,
    })

    return data.reverse()
  }
}
