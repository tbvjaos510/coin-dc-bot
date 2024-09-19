import {tool} from "@langchain/core/tools";
import {ubitExchangeService, ubitQuoationService} from "../containers/upbit";
import {z} from "zod";

const getMarkets = tool(async () => {
  const markets = await ubitQuoationService.getMarketAllInfo();

  return [markets.KRW.map(market => JSON.stringify(market)).join('\n'), markets.KRW];
}, {
  name: 'get_markets',
  description: '가상화폐 마켓 조회',
  responseFormat: 'content_and_artifact'
})

const getMyAccount = tool(async () => {
  const accounts = await ubitExchangeService.getAllAccount();

  return [`현재 계좌 잔고: ${accounts.map(account => `${account.currency}: ${account.balance}개. 평균 매수금:${account.avg_buy_price}`).join('\n')}`, accounts];
}, {
  name: 'get_my_account',
  description: '내 계좌 조회',
  responseFormat: 'content_and_artifact'
})

const getMinutesCandles = tool(async ({marketCoin, count}) => {
  const candles = await ubitQuoationService.getMinutesCandles({
    minutes: "1",
    marketCoin,
    count
  });

  return [candles
    .map(candle => JSON.stringify({
    '시가': candle.opening_price,
    '고가': candle.high_price,
    '저가': candle.low_price,
    '종가': candle.trade_price,
    '거래량': candle.candle_acc_trade_volume,
    '거래대금': candle.candle_acc_trade_price,
  })).join('\n'), candles];
}, {
  name: 'get_minutes_candles',
  description: '현재 마켓 가격(분봉) 조회',
  responseFormat: 'content_and_artifact',
  schema: z.object({
    marketCoin: z.string({ description: '마켓 코인' }),
    count: z.number({ description: '조회할 개수' })
  })
})

export const upbitAccountTools = [
  getMarkets, getMyAccount, getMinutesCandles
]
