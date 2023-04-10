import { CallbackManager } from 'langchain/callbacks';
import { loadQAChain, VectorDBQAChain } from 'langchain/chains';
import { OpenAI } from 'langchain/llms';
import { PromptTemplate } from 'langchain/prompts';
import { VectorStore } from 'langchain/vectorstores';

/**
 * A prompt for formatting answer format
 */
const QA_PROMPT = PromptTemplate.fromTemplate(
  `You are an AI assistant providing helpful advice. You are given the following extracted parts of a long document and a question. Provide a conversational answer based on the context provided.
You should only provide hyperlinks that reference the context below. Do NOT make up hyperlinks.
If you can't find the answer in the context below, just say "Hmm, I'm not sure." Don't try to make up an answer.
If the question is not related to the context, politely respond that you are tuned to only answer questions that are related to the context.

Question: {question}
=========
{context}
=========
Answer in Markdown:`,
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
