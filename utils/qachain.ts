import { CallbackManager } from 'langchain/callbacks';
import { ChatVectorDBQAChain, LLMChain, loadQAChain } from 'langchain/chains';
import { OpenAIChat } from 'langchain/llms';
import { PromptTemplate } from 'langchain/prompts';
import { VectorStore } from 'langchain/vectorstores';

/**
 * A prompt for compressing question into a compact form.
 */
const CONDENSE_PROMPT =
  PromptTemplate.fromTemplate(`Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`);

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

export const makeChain = (vectorstore: VectorStore, onTokenStream?: (token: string) => void) => {
  const questionGenerator = new LLMChain({
    llm: new OpenAIChat({
      openAIApiKey: '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',
      temperature: 0,
    }),
    prompt: CONDENSE_PROMPT,
  });
  const docChain = loadQAChain(
    new OpenAIChat({
      openAIApiKey: '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',
      temperature: 0,
      modelName: 'gpt-3.5-turbo',
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

  return new ChatVectorDBQAChain({
    vectorstore: vectorstore,
    combineDocumentsChain: docChain,
    questionGeneratorChain: questionGenerator,
    returnSourceDocuments: true,
    k: 2, //number of source documents to return
  });
};
