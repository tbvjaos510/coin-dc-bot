import { UserService } from "./user-service";
import { TradingService } from "./trading-service";
import { TradingCronService } from "./trading-cron-service";

export const userService = new UserService();
export const tradingService = new TradingService();
export const tradingCronService = new TradingCronService(userService ,tradingService);
