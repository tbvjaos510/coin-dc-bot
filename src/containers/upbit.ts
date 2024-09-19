import {ExchangeService, QuoationService} from 'node-upbit';


export const ubitExchangeService = new ExchangeService(process.env.UBIT_ACCESS_KEY!, process.env.UBIT_SECRET_KEY!);
export const ubitQuoationService = new QuoationService();
