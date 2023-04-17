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

export const rephraseVectorDbQA = (
  apiKey: string,
  model: string,
  vectorstore: VectorStore,
  onTokenStream?: (token: string) => void,
) => {
  // for rephrasing the question according to the conversation history
  const questionGenerator = new LLMChain({
    llm: new OpenAIChat({
      openAIApiKey: apiKey,
      temperature: 0,
      modelName: model,
    }),
    prompt: CONDENSE_PROMPT,
  });
  // for asking the rephrased question on the related documents
  const docChain = loadQAChain(
    new OpenAIChat({
      openAIApiKey: apiKey,
      temperature: 0,
      modelName: model,
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
