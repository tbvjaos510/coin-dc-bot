import { QuoationService, UtilsService } from "node-upbit";
import { ExtendedExchangeService } from "./upbit-extended/exchange-service";
import { ExtendedQuoationService } from "./upbit-extended/quoation-service";


export const ubitExchangeService = new ExtendedExchangeService(process.env.UBIT_ACCESS_KEY!, process.env.UBIT_SECRET_KEY!);
export const ubitQuoationService = new ExtendedQuoationService();
export const ubitUtilsService = new UtilsService();
