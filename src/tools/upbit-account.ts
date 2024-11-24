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
    }).filter(account => account.current_price >= 5000);

  const totalBalance = Math.floor(mapAccounts.reduce((acc, account) => acc + account.current_price, 0) + Number(krwAccount?.balance));

  return {
    total_balance: totalBalance,
    accounts: mapAccounts,
    message: `
총 자산 (가상화폐 포함): ${totalBalance.toLocaleString()}원
현재 원화 계좌 잔고: ${Math.floor(Number(krwAccount?.balance)).toLocaleString()}원

보유 가상화폐:
${mapAccounts.map(account => `**${account.market}**: 현재 ${account.current_price}원, 수익률 ${account.change_rate}`).join("\n")}`,
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

  const getTopTotalPriceCoins = tool(async ({ count }) => {
    const tickers = await ubitQuoationService.getTickerAll(["KRW"]);

    const topCoins = tickers
      .filter(ticker => ticker.market.startsWith("KRW-"))
      .map(ticker => ({
        market: ticker.market,
        total_price: ticker.acc_trade_price_24h,
      }))
      .sort((a, b) => b.total_price - a.total_price)
      .slice(0, count);

    return `거래대금 상위 ${count}개 코인:
${topCoins.map((coin, index) => `${index + 1}등. ${coin.market}`).join("\n")}`;
  }, {
    name: "get_top_total_price_coins",
    description: "총 거래대금 상위 코인 조회",
    schema: z.object({
      count: z.number({ description: "조회할 개수" }),
    }),
  });


  const buyCoin = tool(async ({ marketCoin, price }) => {
    if (price % 1000 !== 0) {
      return "매수 주문 실패: 가격은 1000원 단위로 입력해주세요.";
    }

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
      price: z.number({ description: "매수 가격 (5000원 이상, 1000원 단위)" }).min(5000),
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

    const lastAccounts = await ubitExchangeService.getAllAccount();
    const krAccount = lastAccounts.find(account => account.currency === "KRW");

    return `매도 주문 결과:
마켓: ${result.market}
채결금: ${Math.round(Number(result.executed_funds))}원
보유 원화: ${Math.floor(Number(krAccount?.balance))}원
  `;
  }, {
    name: "sell_coin",
    description: "지정 코인 매도 주문 (시장가)",
    schema: z.object({
      marketCoin: z.string({ description: "마켓 코인 (KRW- 로 시작)" }),
      volumePercent: z.number({ description: "매도 비율 % (1~100)" }).min(1).max(100),
    }),
  });

  const sellCoinsWithCondition = tool(async ({ changeRate, moreOrLess, volumePercent }) => {
    const accounts = await ubitExchangeService.getAllAccount();
    const tickers = await ubitQuoationService.getTickerAll(["KRW"]);

    const sellCoins = accounts
      .filter(account => parseFloat(account.balance) > 0 && account.currency !== "KRW")
      .map(account => {
        const ticker = tickers.find(ticker => ticker.market === `KRW-${account.currency}`);

        if (!ticker) {
          return null;
        }

        const changeRateValue = (ticker.trade_price - parseFloat(account.avg_buy_price)) / parseFloat(account.avg_buy_price) * 100;

        if (moreOrLess === "more" && changeRateValue > changeRate) {
          return {
            market: `KRW-${account.currency}`,
            volume: parseFloat(account.balance) * volumePercent / 100,
          };
        }

        if (moreOrLess === "less" && changeRateValue < changeRate) {
          return {
            market: `KRW-${account.currency}`,
            volume: parseFloat(account.balance) * volumePercent / 100,
          };
        }

        return null;
      }).filter(Boolean) as { market: string, volume: number }[];

    if (sellCoins.length === 0) {
      return `${changeRate}% ${moreOrLess === "more" ? "상승" : "하락"}된 코인이 없습니다.`;
    }

    const results = await Promise.all(sellCoins.map(sellCoin => ubitExchangeService.sellOrder({
      coin: sellCoin.market,
      volume: sellCoin.volume,
    })));

    const lastAccounts = await ubitExchangeService.getAllAccount();
    const krAccount = lastAccounts.find(account => account.currency === "KRW");

    return `${changeRate}% ${moreOrLess === "more" ? "상승" : "하락"} 조건 매도 주문 결과 (${results.length}개 코인 매도):
${results.map(result => `마켓: ${result.market}
채결금: ${Math.round(Number(result.executed_funds))}원`).join("\n")}

현재 원화 계좌 잔고: ${Math.floor(Number(krAccount?.balance))}원
  `;
  }, {
    name: "sell_coins_with_condition",
    description: "특정 수익률 이하/이상 코인들을 매도합니다. (시장가)",
    schema: z.object({
      changeRate: z.number({ description: "조건 매도 수익률 % (-100 ~ 100)" }).min(-100).max(100),
      moreOrLess: z.enum(["more", "less"]),
      volumePercent: z.number({ description: "매도 비율 % (1~100)" }).min(1).max(100),
    }),
  });

  return [
    getMarkets,
    getMyAccount,
    sellCoinsWithCondition,
    getTopTotalPriceCoins,
    // getMinutesCandles,
    buyCoin,
    sellCoin,
  ];
}
