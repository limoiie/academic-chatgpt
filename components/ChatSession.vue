<template>
  <div id="component" class="w-full h-full flex flex-col items-stretch flex-1 relative overflow-hidden">
    <div id="content" class="flex flex-col items-center flex-[1_1_0] overflow-auto">
      <ChatConversation class="w-full max-w-4xl" :conversation="conversation" :scroll-to-end="scrollToEnd" />
    </div>
    <div class="absolute bottom-21 right-12 z-10 hover:shadow-lg duration-300">
      <a-tooltip title="Chat Mode">
        <a-select v-model:value="currentChainMode" :options="availableChainModeOptions"></a-select>
      </a-tooltip>
    </div>
    <div
      class="w-full flex flex-row items-center bottom-0 left-0 pr-12 py-6 bg-gradient-to-t from-[#FFFFFF_75%] absolute rounded"
    >
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
        <a-button class="!border-0" :loading="generating" size="large" shape="circle" @click="requestChatCompletion">
          <template #icon>
            <SendOutlined />
          </template>
        </a-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ClearOutlined, SendOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { Embeddings } from 'langchain/embeddings';
import { SystemChatMessage } from 'langchain/schema';
import { VectorStore } from 'langchain/vectorstores';
import { storeToRefs } from 'pinia';
import { ref } from 'vue';
import { UiChatConversation, UiChatDialogue } from '~/composables/beans/Chats';
import { useDefaultAIStore } from '~/store/defaultAI';
import { noHistoryVectorDbQA } from '~/utils/aichains/noHistoryVectorDbQA';
import { rephraseVectorDbQA } from '~/utils/aichains/rephraseVectorDbQA';
import {
  CollectionIndexProfile,
  GetEmbeddingsClientData,
  getEmbeddingsClients,
  getEmbeddingsConfigById,
  GetEmbeddingsConfigData,
  GetVectorDbConfigData,
  Session,
  updateSession,
} from '~/utils/bindings';
import { createVectorstore } from '~/utils/vectorstores';

const { indexProfile, session } = defineProps<{ indexProfile: CollectionIndexProfile; session: Session }>();

const input = ref('');
const generating = ref(false);
const scrollToEnd = ref(false);

const conversation = ref<UiChatConversation>(
  new UiChatConversation(new SystemChatMessage('You are an assistant and going to help my coding.')),
);

const defaultAIStore = useDefaultAIStore();
const { defaultAIClient, defaultAIApiKey, defaultAIModel } = storeToRefs(defaultAIStore);
await defaultAIStore.loadFromLocalStore();
console.log('default', defaultAIClient.value, defaultAIApiKey.value, defaultAIModel.value);

const specifiedAIClient = ref<string | undefined>(undefined);
const specifiedAIApiKey = ref<string | undefined>(undefined);
const specifiedAIModel = ref<string | undefined>(undefined);

const currentAIClient = computed(() => specifiedAIClient.value || defaultAIClient.value);
const currentAIApiKey = computed(() => specifiedAIApiKey.value || defaultAIApiKey.value);
const currentAIModel = computed(() => specifiedAIModel.value || defaultAIModel.value);

interface Context {
  indexProfile: CollectionIndexProfile;
  embeddingsClient: GetEmbeddingsClientData;
  embeddingsConfig: GetEmbeddingsConfigData;
  vectorDbConfig: GetVectorDbConfigData;
  embeddings: Embeddings;
  vectorDb: VectorStore;
}

const { data: context } = useAsyncData('context', async () => {
  const vectorDbConfig = indexProfile ? await getVectorDbConfigById(indexProfile.vectordbConfigId) : undefined;
  const embeddingsClient = indexProfile ? (await getEmbeddingsClients())[0] : undefined;
  const embeddingsConfig = indexProfile ? await getEmbeddingsConfigById(indexProfile.embeddingsConfigId) : undefined;
  if (!indexProfile || !vectorDbConfig || !embeddingsClient || !embeddingsConfig) {
    message.info(`Failed to load data: invalid index config`);
    return null;
  }

  // fixme: correct following
  // const namespace = namespaceOfProfile(indexProfile);
  const namespace = 'debug-dojo';
  const embeddings = await createEmbeddings(embeddingsClient, embeddingsConfig);
  const vectorDb = await createVectorstore(vectorDbConfig, embeddings, namespace);

  return { indexProfile, embeddingsClient, embeddingsConfig, vectorDbConfig, vectorDb, embeddings } as Context;
});

const availableChainModes = ref(['RephraseHistory+VectorDbQA', 'ChatWithoutHistory+VectorDbQA']);
const availableChainModeOptions = computed(() => {
  return availableChainModes.value.map((m) => {
    return { label: m, value: m };
  });
});
const currentChainMode = ref('RephraseHistory+VectorDbQA');

async function buildChain(latestInput: string) {
  const contextValue = context.value;
  if (!contextValue) {
    message.error('Profile not load: maybe reload would solve the problem');
    return;
  }

  const [client, apiKey, model] = [currentAIClient.value, currentAIApiKey.value, currentAIModel.value];
  if (!client || !apiKey || !model) {
    console.log('client', client, defaultAIClient.value);
    console.log('apiKey', apiKey, defaultAIApiKey.value, specifiedAIApiKey.value);
    console.log('model', model);
    message.error('Invalid AI client: please specify a client');
    return;
  }

  const vectorstore = toRaw<VectorStore>(contextValue.vectorDb);
  switch (currentAIClient.value) {
    case 'openai':
      switch (currentChainMode.value) {
        case 'RephraseHistory+VectorDbQA':
          const chain1 = rephraseVectorDbQA(apiKey, model, vectorstore, onTokenStream);
          return await chain1.call({
            question: latestInput,
            chat_history: conversation.value.extractHistory(),
          });
        case 'ChatWithoutHistory+VectorDbQA':
          const chain2 = noHistoryVectorDbQA(apiKey, model, vectorstore, onTokenStream);
          return await chain2.call({
            query: latestInput,
          });
        default:
          message.error(`Unsupported chain mode for ${currentAIClient.value}: ${currentChainMode.value}`);
      }
      break;
    default:
      message.error(`Unsupported ai client: ${currentAIClient.value}`);
      return;
  }
}

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

loadConversationHistory();

async function onTokenStream(token: string) {
  // get the latest dialogue and update the AI message
  const dialogue = conversation.value.dialogues.at(-1);
  if (dialogue?.answering) {
    dialogue.answering.message.text += token;
  }
}

async function requestChatCompletion() {
  const latestInput = input.value;
  input.value = '';

  if (latestInput) {
    // construct the new dialogue
    const dialogue = await conversation.value.question(latestInput);

    intoLoadingMode();
    scrollToEnd.value = !scrollToEnd.value;

    // update the memory by extracting from ui
    try {
      const response = await buildChain(latestInput);
      if (response) {
        await dialogue.answerChainValues(response);
        await saveConversationHistory();
      } else {
        conversation.value.dialogues.pop();
      }
    } catch (e: any) {
      console.log('error stack', e.stack)
      await dialogue.failedToAnswer(e.toString());
      await saveConversationHistory();
    }

    exitLoadingMode();
    scrollToEnd.value = !scrollToEnd.value;
  }
}

function intoLoadingMode() {
  input.value = '';
  generating.value = true;
}

function exitLoadingMode() {
  generating.value = false;
}

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
