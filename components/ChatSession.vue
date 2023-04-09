<template>
  <div id="component" class="w-full h-full flex flex-col items-stretch flex-1 relative overflow-hidden">
    <div id="content" class="flex flex-col items-center flex-[1_1_0] overflow-auto">
      <ChatConversation class="w-full max-w-4xl" :conversation="conversation" :scroll-to-end="scrollToEnd" />
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
import { ref } from 'vue';
import { UiChatConversation, UiChatDialogue } from '~/composables/beans/Chats';
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
import { makeChain } from '~/utils/qachain';
import { createVectorstore } from '~/utils/vectorstores';

const { indexProfile, session } = defineProps<{ indexProfile: CollectionIndexProfile; session: Session }>();

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

/// State variables
const input = ref('');
const generating = ref(false);
const scrollToEnd = ref(false);

const conversation = ref<UiChatConversation>(
  new UiChatConversation(new SystemChatMessage('You are an assistant and going to help my coding.')),
);

function loadHistory() {
  try {
    conversation.value.dialogues = UiChatDialogue.loadArray(session.history);
  } catch (e: any) {
    console.log(`Failed to load dialogues: ${e.toString()}`);
  }
}

async function saveHistory() {
  session.history = UiChatDialogue.dumpArray(conversation.value.dialogues);
  await updateSession({
    id: session.id,
    history: session.history,
    name: session.name,
  });
}

async function clearDialogues() {
  conversation.value.dialogues = [];
  await saveHistory();
}

loadHistory();

async function onTokenStream(token: string) {
  // get the latest dialogue and update the AI message
  const dialogue = conversation.value.dialogues.at(-1);
  if (dialogue) {
    dialogue.answering.message.text += token;
  }
}

async function requestChatCompletion() {
  const contextValue = context.value;
  if (!contextValue) {
    message.warn('Profile not load: maybe reload would solve the problem');
    return;
  }

  const latestInput = input.value;
  input.value = '';

  if (latestInput) {
    const vectorstore = toRaw<VectorStore>(contextValue.vectorDb);
    const chain = makeChain(vectorstore, onTokenStream);

    // construct the new dialogue
    const dialogue = await conversation.value.question(latestInput);

    intoLoadingMode();
    scrollToEnd.value = !scrollToEnd.value;

    // update the memory by extracting from ui
    try {
      // const llmResult = await chat.generate([conversation.value.extractMessages()]);
      // await dialogue.answer(llmResult);
      const response = await chain.call({
        question: latestInput,
        chat_history: conversation.value.extractHistory(),
      });
      await dialogue.answerChainValues(response);
      await saveHistory();
    } catch (e) {
      await dialogue.failedToAnswer(e);
      console.log('Failed to complement:', e);
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