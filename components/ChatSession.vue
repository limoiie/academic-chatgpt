<template>
  <div id="component" class="w-full h-full flex flex-col items-stretch flex-1 relative overflow-hidden">
    <div class="w-full h-2 z-10 absolute top-0 bg-gradient-to-b from-gray-100 dark:from-black"></div>
    <div id="content" class="flex flex-col items-center overflow-scroll">
      <ChatConversation
        class="w-full"
        :conversation="conversation"
        :scroll-to-end="conversationUpdated"
        :auto-scroll-to-end="autoScrollToEnd"
        @stop-answering="onStopGenerating"
      />
    </div>
    <div class="w-full flex flex-col items-center absolute bottom-0 left-0">
      <a-space class="px-4">
        <a-tooltip title="Auto scroll to end">
          <a-button shape="circle" :type="autoScrollToEnd ? 'primary' : 'dashed'" @click="enableAutoScrollToEnd">
            <template #icon>
              <VerticalAlignBottomOutlined />
            </template>
          </a-button>
        </a-tooltip>
        <a-tooltip title="Completion Model" placement="bottom">
          <a-select
            v-model:value="sessionProfile.completionConfig.meta.model"
            :options="allCompletionModelOptions"
          ></a-select>
        </a-tooltip>
        <a-tooltip title="Chat Mode" placement="bottom">
          <a-select v-model:value="sessionProfile.completionChainMode" :options="availableChainModeOptions"></a-select>
        </a-tooltip>
      </a-space>
      <div class="w-full h-2 z-10 bg-gradient-to-t from-white dark:from-[#1f1f1f]" />
      <div class="w-full pt-2 pr-8 pb-6 flex flex-row items-center bg-white dark:bg-[#1f1f1f] rounded">
        <a-button class="mx-4 dark:mx-4" type="primary" shape="circle" @click="clearDialogues">
          <template #icon>
            <ClearOutlined />
          </template>
        </a-button>
        <div
          class="px-2 py-1 flex flex-1 flex-row items-center border-1 dark:border-gray-600 rounded hover:border-blue-400 focus-within:shadow-md focus-within:shadow-blue-400 duration-300"
        >
          <a-textarea
            id="input"
            v-model:value="input"
            allow-clear
            placeholder="Ask something about the collection"
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
import { ClearOutlined, SendOutlined, VerticalAlignBottomOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { Embeddings } from 'langchain/embeddings';
import { SystemChatMessage } from 'langchain/schema';
import { VectorStore } from 'langchain/vectorstores';
import { storeToRefs } from 'pinia';
import { ref, toRef } from 'vue';
import { UiChatConversation, UiChatDialogue } from '~/composables/beans/Chats';
import { useScrollOverflow } from '~/composables/useScrollOverflow';
import { CollectionIndexWithAll, Session } from '~/plugins/tauri/bindings';
import { useAppSettingsStore } from '~/store/appSettingsStore';
import { SessionProfile } from '~/store/sessions';
import { allCompletionChainModes, allCompletionModels } from '~/types';
import { runChain } from '~/utils/completionChains';
import { createEmbeddings } from '~/utils/embeddings';
import { createVectorstore } from '~/utils/vectorstores';

const props = defineProps<{
  collectionIndex: CollectionIndexWithAll;
  session: Session;
  sessionProfile: SessionProfile;
}>();
const { collectionIndex, session } = props;
const sessionProfile = toRef(props, 'sessionProfile');

const { $tauriCommands } = useNuxtApp();

const input = ref('');
const isCompleting = ref(false);
const conversationUpdated = ref(0);
const autoScrollToEnd = ref(false);
const appSettingsStore = useAppSettingsStore();
const { appSettings } = storeToRefs(appSettingsStore);

const conversation = ref<UiChatConversation>(
  new UiChatConversation(new SystemChatMessage('You are an assistant and going to help my to summary documents.')),
);

const availableChainModeOptions = computed(() => {
  const modes = allCompletionChainModes[sessionProfile.value.completionConfig.client] || [];
  return modes.map((m) => {
    return { label: m, value: m };
  });
});
const allCompletionModelOptions = computed(() => {
  const models = allCompletionModels[sessionProfile.value.completionConfig.client] || [];
  return models.map((model) => {
    return {
      label: model,
      value: model,
    };
  });
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
  ).catch((e: any) => {
    message.error(`Failed to create embeddings: ${e.toString()}`);
    throw e;
  });
  const vectorstore = await createVectorstore(
    collectionIndex.index.vectorDbClient,
    collectionIndex.index.vectorDbConfig,
    embeddings,
    namespace,
  ).catch((e: any) => {
    message.error(`Failed to create vectorstore: ${e.toString()}`);
    throw e;
  });

  return {
    collectionIndex,
    vectorstore,
    embeddings,
  } as Context;
});

onMounted(async () => {
  const conversationContainerEl = document.getElementById('content');
  if (conversationContainerEl) {
    useScrollOverflow(conversationContainerEl, 20, autoScrollToEnd);
  }

  const inputEl = document.getElementById('input');
  if (inputEl) {
    inputEl.focus();
  }

  await Promise.resolve().then(async () => {
    await appSettingsStore.load();
    loadConversationHistory();
    // scroll to end when the conversation is loaded
    setTimeout(enableAutoScrollToEnd, 400);
  });
});

function enableAutoScrollToEnd() {
  autoScrollToEnd.value = true;
  scrollToEnd();
}

function scrollToEnd() {
  ++conversationUpdated.value;
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
  await $tauriCommands.updateSession({
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
 * Request the AI completion client to complete the input.
 */
async function requestChatCompletion() {
  const latestInput = input.value;
  if (!latestInput) return;
  input.value = '';

  const contextValue = context.value;
  if (!contextValue) {
    message.error('Profile not load: maybe reload would solve the problem');
    return;
  }

  // construct the new dialogue
  const dialogue = await conversation.value.question(latestInput, appSettings.value.username);

  /**
   * Push the new token to the corresponding dialogue.
   * This function is called when the AI completion client is generating the response
   *
   * @param token the token generated by the AI completion client
   */
  function onTokenStream(token: string) {
    // get the latest dialogue and update the AI message
    if (dialogue?.answering) {
      dialogue.answering.message.text += token;
    }
  }

  await Promise.resolve((isCompleting.value = true))
    .then(async () => {
      enableAutoScrollToEnd();
      const vectorstore = toRaw<VectorStore>(contextValue.vectorstore);
      const response = await runChain(
        sessionProfile.value.completionConfig,
        sessionProfile.value.completionChainMode,
        latestInput,
        conversation.value,
        vectorstore,
        onTokenStream,
      );
      if (!dialogue.answering) {
        // the dialogue has been stopped
        await saveConversationHistory();
        return true;
      }
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
    .finally((stopped: boolean | void) => {
      if (!stopped) {
        isCompleting.value = false;
      }
    });
}

/**
 * Quickly recover the completion status on stop generating.
 */
function onStopGenerating(dialogue: UiChatDialogue) {
  dialogue.stopAnswering();
  isCompleting.value = false;
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
