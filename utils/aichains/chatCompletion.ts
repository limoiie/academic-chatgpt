import { CallbackManager } from 'langchain/callbacks';
import { OpenAIChat } from 'langchain/llms';
import { ChatCompletionRequestMessage } from 'openai';

export const chatCompletion = (
  apiKey: string,
  modelName: string,
  prefixMessages: ChatCompletionRequestMessage[],
  onTokenStream?: (token: string) => void,
) => {
  return new OpenAIChat({
    openAIApiKey: apiKey,
    temperature: 0,
    modelName: modelName,
    streaming: Boolean(onTokenStream),
    callbackManager: onTokenStream
      ? CallbackManager.fromHandlers({
          async handleLLMNewToken(token) {
            onTokenStream(token);
          },
        })
      : undefined,
    prefixMessages: prefixMessages,
  });
};
