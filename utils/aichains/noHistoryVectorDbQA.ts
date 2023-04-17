import { CallbackManager } from 'langchain/callbacks';
import { loadQAChain, VectorDBQAChain } from 'langchain/chains';
import { OpenAI } from 'langchain/llms';
import { PromptTemplate } from 'langchain/prompts';
import { VectorStore } from 'langchain/vectorstores';

/**
 * A prompt for formatting answer format
 *
 * Referring to https://github.com/mayooear/gpt4-pdf-chatbot-langchain
 */
const QA_PROMPT = PromptTemplate.fromTemplate(
  `You are an AI assistant helping user understanding documents. You need to answer a given question by referencing a few given sections of a collection of documents.
The sections as context are wrapped between two ========= tags. If you can't find answer in the context, just say "Sorry, I cannot find references from the document collection".

Question: {question}
=========
{context}
=========
Answer in Markdown (Code block MUST have a correct language tag):`,
);

export const noHistoryVectorDbQA = (
  apiKey: string,
  modelName: string,
  vectorstore: VectorStore,
  onTokenStream?: (token: string) => void,
) => {
  // for asking the rephrased question on the related documents
  const docChain = loadQAChain(
    new OpenAI({
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
    }),
    { prompt: QA_PROMPT },
  );

  return new VectorDBQAChain({
    vectorstore: vectorstore,
    combineDocumentsChain: docChain,
    returnSourceDocuments: true,
    k: 2, //number of source documents to return
  });
};
