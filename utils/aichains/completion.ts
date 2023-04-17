import { CallbackManager } from 'langchain/callbacks';
import { OpenAI } from 'langchain/llms';

export const completion = (apiKey: string, modelName: string, onTokenStream?: (token: string) => void) => {
  return new OpenAI({
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
  });
};
