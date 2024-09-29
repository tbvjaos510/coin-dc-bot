import "dotenv/config";
import { upbitAccountTools } from "./tools/upbit-account";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { communityTools } from "./tools/community";
import { SYSTEM_MESSAGE, USER_MESSAGE } from "./messages";

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

const agentTools = [
  ...upbitAccountTools,
  ...communityTools,
];
const agentModel = new ChatOpenAI({ temperature: 0, model: "gpt-4o-mini" });

export const graph = createReactAgent({
  llm: agentModel,
  tools: agentTools,
  messageModifier: SYSTEM_MESSAGE,
});

const main = async () => {
  const result = await graph.stream({
    messages: [
      USER_MESSAGE,
    ],
  }, { streamMode: "values" });

  let lastMessages = [];
  for await (const { messages } of result) {

    lastMessages = messages;
  }

  console.log(lastMessages);

  if (DISCORD_WEBHOOK) {
    const lastMessage = lastMessages[lastMessages.length - 1];

    if (lastMessage) {
      await fetch(DISCORD_WEBHOOK, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: lastMessage.content,
        }),
      });
    }
  }
};

main();


