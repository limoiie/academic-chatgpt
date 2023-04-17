<template>
  <div id="component" class="w-full h-full flex flex-col items-stretch flex-1 relative overflow-hidden">
    <div class="w-full h-2 z-10 absolute top-0 bg-gradient-to-b from-white"></div>
    <div id="content" class="flex flex-col items-center flex-[1_1_0] overflow-auto">
      <ChatConversation class="w-full max-w-4xl" :conversation="conversation" :scroll-to-end="scrollToEnd" />
    </div>
    <div class="w-full flex flex-col items-center absolute bottom-0 left-0">
      <div class="mr-12 self-end hover:shadow-lg duration-300">
        <a-tooltip title="Chat Mode">
          <a-select v-model:value="currentChainMode" :options="availableChainModeOptions"></a-select>
        </a-tooltip>
      </div>
      <div class="w-full h-2 z-10 bg-gradient-to-t from-[#FFFFFF]" />
      <div class="w-full flex flex-row items-center bg-white pr-12 pb-6 rounded">
        <a-button class="mx-4" type="primary" shape="circle" @click="clearDialogues">
          <template #icon>
            <ClearOutlined />
          </template>
        </a-button>
        <div class="px-2 py-1 flex flex-1 flex-row items-center border-1 rounded">
          <a-textarea
            v-model:value="input"
            allow-clear
            placeholder="Input message"
            class="ant-input-borderless"
            size="large"
            :auto-size="{ minRows: 1, maxRows: 5 }"
            @keydown="handleKeydownInTextarea"
          />
          <a-button
            class="!border-0"
            :loading="isCompleting"
            size="large"
            shape="circle"
            @click="requestChatCompletion"
          >
            <template #icon>
              <SendOutlined />
            </template>
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ClearOutlined, SendOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { Embeddings } from 'langchain/embeddings';
import { ChainValues, SystemChatMessage } from 'langchain/schema';
import { VectorStore } from 'langchain/vectorstores';
import { storeToRefs } from 'pinia';
import { ref } from 'vue';
import { UiChatConversation, UiChatDialogue } from '~/composables/beans/Chats';
import { useDefaultCompleteStore } from '~/store/defaultComplete';
import { chatCompletion } from '~/utils/aichains/chatCompletion';
import { completion } from '~/utils/aichains/completion';
import { noHistoryVectorDbQA } from '~/utils/aichains/noHistoryVectorDbQA';
import { rephraseVectorDbQA } from '~/utils/aichains/rephraseVectorDbQA';
import { CollectionIndexWithAll, Session, updateSession } from '~/utils/bindings';
import { createVectorstore } from '~/utils/vectorstores';

const { collectionIndex, session } = defineProps<{
  collectionIndex: CollectionIndexWithAll;
  session: Session;
}>();

const input = ref('');
const isCompleting = ref(false);
const scrollToEnd = ref(false);

const conversation = ref<UiChatConversation>(
  new UiChatConversation(new SystemChatMessage('You are an assistant and going to help my to summary documents.')),
);

const availableChainModes = ref(['WithoutHistory', 'RephraseHistory', 'Completion', 'ChatCompletion']);
const availableChainModeOptions = computed(() => {
  return availableChainModes.value.map((m) => {
    return { label: m, value: m };
  });
});
const currentChainMode = ref('WithoutHistory');

const defaultCompleteStore = useDefaultCompleteStore();
const { defaultCompleteConfig } = storeToRefs(defaultCompleteStore);

interface CompletionConfig {
  client: string;
  apiKey: string;
  model: string;
}

const completionConfig = reactive<CompletionConfig>({
  client: defaultCompleteConfig.value.client,
  apiKey: defaultCompleteConfig.value.meta.apiKey,
  model: defaultCompleteConfig.value.meta.model,
});

interface Context {
  collectionIndex: CollectionIndexWithAll;
  vectorstore: VectorStore;
  embeddings: Embeddings;
}

const { data: context } = useAsyncData(`contextOfSession#${session.id}`, async () => {
  const namespace = collectionIndex.id;
  const embeddings = await createEmbeddings(
    collectionIndex.index.embeddingsClient,
    collectionIndex.index.embeddingsConfig,
  );
  const vectorstore = await createVectorstore(
    collectionIndex.index.vectorDbClient,
    collectionIndex.index.vectorDbConfig,
    embeddings,
    namespace,
  );

  return {
    collectionIndex,
    vectorstore,
    embeddings,
  } as Context;
});

await Promise.resolve().then(async () => {
  await defaultCompleteStore.load();
  loadConversationHistory();
});

function loadConversationHistory() {
  try {
    conversation.value.dialogues = UiChatDialogue.loadArray(session.history);
  } catch (e: any) {
    message.error(`Failed to load dialogues: ${e.toString()}`);
  }
}

async function saveConversationHistory() {
  session.history = UiChatDialogue.dumpArray(conversation.value.dialogues);
  await updateSession({
    id: session.id,
    history: session.history,
    name: session.name,
  });
}

async function clearDialogues() {
  conversation.value.dialogues = [];
  await saveConversationHistory();
}

/**
 * Push the new token to the corresponding dialogue.
 * This function is called when the AI completion client is generating the response
 *
 * @param token the token generated by the AI completion client
 */
async function onTokenStream(token: string) {
  // get the latest dialogue and update the AI message
  const dialogue = conversation.value.dialogues.at(-1);
  if (dialogue?.answering) {
    dialogue.answering.message.text += token;
    scrollToEnd.value = !scrollToEnd.value;
  }
}

/**
 * Request the AI completion client to complete the input.
 */
async function requestChatCompletion() {
  const latestInput = input.value;
  if (!latestInput) return;
  input.value = '';

  // construct the new dialogue
  const dialogue = await conversation.value.question(latestInput);

  await Promise.resolve((isCompleting.value = true))
    .then(async () => {
      // scrollToEnd.value = !scrollToEnd.value;
      // update the memory by extracting from ui
      const response = await buildAndExecChain(latestInput);
      if (response) {
        await dialogue.answerChainValues(response);
        await saveConversationHistory();
      } else {
        conversation.value.dialogues.pop();
      }
    })
    .catch(async (e: any) => {
      await dialogue.failedToAnswer(errToString(e));
      await saveConversationHistory();
      message.error(`Failed to complete: ${errToString(e)}`);
    })
    .finally(() => {
      isCompleting.value = false;
      // scrollToEnd.value = !scrollToEnd.value;
    });
}

/**
 * Build the completion chain and execute it.
 *
 * @param question
 */
async function buildAndExecChain(question: string) {
  const contextValue = context.value;
  if (!contextValue) {
    message.error('Profile not load: maybe reload would solve the problem');
    return;
  }

  const { client, apiKey, model } = completionConfig;
  if (!client || !apiKey || !model) {
    message.error('Invalid completion client: please specify a client');
    return;
  }

  const vectorstore = toRaw<VectorStore>(contextValue.vectorstore);
  switch (client) {
    case 'openai':
      switch (currentChainMode.value) {
        case 'RephraseHistory':
          const chain1 = rephraseVectorDbQA(apiKey, model, vectorstore, onTokenStream);
          return await chain1.call({
            question: question,
            chat_history: conversation.value.extractHistoryAsQAPairs(),
          });
        case 'WithoutHistory':
          const chain2 = noHistoryVectorDbQA(apiKey, model, vectorstore, onTokenStream);
          return await chain2.call({
            query: question,
          });
        case 'ChatCompletion':
          const history = conversation.value.extractHistoryInOpenAIChatCompletion();
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
      message.error(`Unsupported AI completion client: ${client}`);
      return;
  }
}

/**
 * Request chat completion when the user presses 'Enter' in the input field.
 */
function handleKeydownInTextarea(e: KeyboardEvent) {
  if (!e.shiftKey && e.key === 'Enter') {
    requestChatCompletion();
    e.preventDefault();
  }
}
</script>

<style lang="sass">
.ant-input-clear-icon
  top: 13px !important
</style>
