import { message } from 'ant-design-vue';
import { ChainValues } from 'langchain/schema';
import { VectorStore } from 'langchain/vectorstores';
import { UiChatConversation } from '~/composables/beans/Chats';
import { CompletionChainModeType } from '~/types';
import { chatCompletion } from '~/utils/aichains/chatCompletion';
import { completion } from '~/utils/aichains/completion';
import { noHistoryVectorDbQA } from '~/utils/aichains/noHistoryVectorDbQA';
import { rephraseVectorDbQA } from '~/utils/aichains/rephraseVectorDbQA';

export async function runChain(
  completionConfig: CompletionConfig,
  chainMode: CompletionChainModeType,
  question: string,
  conversation: UiChatConversation,
  vectorstore: VectorStore,
  onTokenStream?: (token: string) => void,
) {
  switch (completionConfig.client) {
    case 'openai':
      const apiKey = completionConfig.meta.apiKey;
      const model = completionConfig.meta.model;

      switch (chainMode) {
        case 'RephraseHistory':
          const chain1 = rephraseVectorDbQA(apiKey, model, vectorstore, onTokenStream);
          return await chain1.call({
            question: question,
            chat_history: conversation.extractHistoryAsQAPairs(),
          });
        case 'WithoutHistory':
          const chain2 = noHistoryVectorDbQA(apiKey, model, vectorstore, onTokenStream);
          return await chain2.call({
            query: question,
          });
        case 'ChatCompletion':
          const history = conversation.extractHistoryInOpenAIChatCompletion();
          const normalChatChain = chatCompletion(apiKey, model, history, onTokenStream);
          return {
            text: await normalChatChain.call(question),
          } as ChainValues;
        default:
          const normalChain = completion(apiKey, model, onTokenStream);
          return {
            text: await normalChain.call(question),
          } as ChainValues;
      }
    default:
      message.error(`Unsupported AI completion client: ${completionConfig.client}`);
      return;
  }
}
