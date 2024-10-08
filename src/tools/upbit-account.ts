import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ExtendedQuoationService } from "../containers/upbit-extended/quoation-service";
import { ExtendedExchangeService } from "../containers/upbit-extended/exchange-service";
import { IAccountProps } from "node-upbit/lib/@types/exchange";

const ubitQuoationService = new ExtendedQuoationService();

export const prettyMyAccount = async (accounts: IAccountProps[]) => {
  const tickers = await ubitQuoationService.getTickerAll(["KRW"]);
  const krwAccount = accounts.find(account => account.currency === "KRW");

  const mapAccounts: {
    market: string;
    currency: string;
    balance: number;
    buy_price: number;
    current_price: number;
    change_rate: string;
  }[] = accounts
    .filter(account => parseFloat(account.balance) > 0 && account.currency !== "KRW")
    .map(account => {
      const ticker = tickers.find(ticker => ticker.market === `KRW-${account.currency}`);

      if (!ticker) {
        return {
          market: account.currency,
          currency: account.currency,
          balance: parseFloat(account.balance),
          buy_price: parseFloat(account.avg_buy_price),
          current_price: 0,
          change_rate: "0%",
        };
      }
      return {
        market: ticker.market,
        currency: account.currency,
        balance: parseFloat(account.balance),
        buy_price: Math.floor(parseFloat(account.avg_buy_price) * parseFloat(account.balance)),
        current_price: Math.floor(ticker.trade_price * parseFloat(account.balance)),
        change_rate: `${((ticker.trade_price - parseFloat(account.avg_buy_price)) / parseFloat(account.avg_buy_price) * 100).toFixed(2)}%`,
      };
    });

  const totalBalance = Math.floor(mapAccounts.reduce((acc, account) => acc + account.current_price, 0) + Number(krwAccount?.balance));

  return {
    total_balance: totalBalance,
    accounts: mapAccounts,
    message: `
총 자산 (가상화폐 포함): ${totalBalance.toLocaleString()}원
현재 원화 계좌 잔고: ${Math.floor(Number(krwAccount?.balance)).toLocaleString()}원

보유 가상화폐:
${mapAccounts.map(account => `${account.market}:
  보유량: ${account.balance}개
  구매 가격: ${account.buy_price}원
  현재 가격: ${account.current_price}원
  수익률: ${account.change_rate}`).join("\n---------\n")}`
  };
};


export function getUpbitTools(ubitExchangeService: ExtendedExchangeService) {
  const getMarkets = tool(async () => {
    const markets = await ubitQuoationService.getMarketAllInfo();
    const tickers = await ubitQuoationService.getTicker(markets.KRW.map(market => market.market));

    const mapMarkets = markets.KRW.map(market => {
      const ticker = tickers.find(ticker => ticker.market === market.market);

      return {
        market: market.market,
        korean_name: market.korean_name,
        trade_price: ticker?.trade_price,
      };
    });

    return `마켓 목록:
${mapMarkets.map(market => `${market.market}: ${market.korean_name} / `).join("\n")}`;
  }, {
    name: "get_markets",
    description: "구매할 수 있는 가상화폐 전체 조회",
  });

  const getMyAccount = tool(async () => {
    const accounts = await ubitExchangeService.getAllAccount();

    return (await prettyMyAccount(accounts)).message;
  }, {
    name: "get_my_account",
    description: "내 가상화폐 및 원화 자산 조회",
  });

  const getMinutesCandles = tool(async ({ marketCoin, count }) => {
    const candles = await ubitQuoationService.getMinutesCandles({
      minutes: "1",
      marketCoin,
      count,
    });

    return candles
      .map(candle => JSON.stringify({
        "시가": candle.opening_price,
        "고가": candle.high_price,
        "저가": candle.low_price,
        "종가": candle.trade_price,
        "거래량": candle.candle_acc_trade_volume,
        "거래대금": candle.candle_acc_trade_price,
      })).join("\n");
  }, {
    name: "get_minutes_candles",
    description: "현재 마켓 가격(분봉) 조회",
    schema: z.object({
      marketCoin: z.string({ description: "마켓 코인 (KRW- 로 시작)" }),
      count: z.number({ description: "조회할 개수" }),
    }),
  });


  const buyCoin = tool(async ({ marketCoin, price }) => {
    const result = await ubitExchangeService.buyOrder({
      coin: marketCoin,
      price,
    });

    return `매수 주문 결과:
마켓: ${result.market}
채결금: ${Math.round(Number(result.executed_funds))}원
`;
  }, {
    name: "buy_coin",
    description: "매수 주문 (시장가)",
    schema: z.object({
      marketCoin: z.string({ description: "마켓 코인 (KRW- 로 시작)" }),
      price: z.number({ description: "매수 가격 (200,000원 이상)" }),
    }),
  });

  const sellCoin = tool(async ({ marketCoin, volumePercent }) => {
    const accounts = await ubitExchangeService.getAllAccount();
    const account = accounts.find(account => account.currency === marketCoin.split("-")[1]);

    if (!account) {
      return "매도 주문 실패: 보유하고 있는 코인이 없습니다.";
    }

    let volume = (parseFloat(account.balance) * volumePercent / 100);

    if (volumePercent === 100) {
      volume = parseFloat(account.balance);
    }

    const result = await ubitExchangeService.sellOrder({
      coin: marketCoin,
      volume,
    });

    return `매도 주문 결과:
마켓: ${result.market}
채결금: ${Math.round(Number(result.executed_funds))}원
  `;
  }, {
    name: "sell_coin",
    description: "매도 주문 (시장가)",
    schema: z.object({
      marketCoin: z.string({ description: "마켓 코인 (KRW- 로 시작)" }),
      volumePercent: z.number({ description: "매도 비율 % (1~100)" }).min(1).max(100),
    }),
  });

  return [
    getMarkets,
    getMyAccount,
    // getMinutesCandles,
    buyCoin,
    sellCoin,
  ];
}
