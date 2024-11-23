import { InteractionController } from "./interaction-controller";
import { MessageController } from "./message-controller";
import { tradingCronService, tradingService, userService } from "../services";

export const interactionController = new InteractionController(userService, tradingService, tradingCronService);
export const messageController = new MessageController(userService, tradingService);
