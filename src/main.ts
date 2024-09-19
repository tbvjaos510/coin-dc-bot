import "dotenv/config";
import {BaseMessage} from "@langchain/core/messages";
import {Annotation, MemorySaver} from "@langchain/langgraph";
import {upbitAccountTools} from "./tools/upbit-account";
import {ChatOpenAI} from '@langchain/openai';
import {createReactAgent} from "@langchain/langgraph/prebuilt";

const GraphAnnotation = Annotation.Root({
  // Define a 'messages' channel to store an array of BaseMessage objects
  messages: Annotation<BaseMessage[]>({
    // Reducer function: Combines the current state with new messages
    reducer: (currentState, updateValue) => currentState.concat(updateValue),
    // Default function: Initialize the channel with an empty array
    default: () => [],
  })
});

const agentTools = [
  ...upbitAccountTools
]
const agentModel = new ChatOpenAI({temperature: 0})

const agentCheckpointer = new MemorySaver();

export const graph = createReactAgent({
  llm: agentModel,
  tools: agentTools,
  checkpointSaver: agentCheckpointer,
});

