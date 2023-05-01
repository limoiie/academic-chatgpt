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
        <a-tooltip title="Completion Model">
          <a-select
            v-model:value="sessionProfile.completionConfig.meta.model"
            :options="allCompletionModelOptions"
          ></a-select>
        </a-tooltip>
        <a-tooltip title="Chat Mode">
          <a-select v-model:value="sessionProfile.completionChainMode">
            <a-select-option
              v-for="{ label, value, tag } of availableChainModeOptions"
              :value="value"
              :label="label"
            >
              <a-tag v-if="tag" color="blue">{{ tag }} </a-tag>
              {{ label }}
            </a-select-option>
          </a-select>
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
            v-model:value="questionInput"
            class="ant-input-borderless"
            placeholder="↑ to previous, ↓ to next, ⇧+↩ to break line"
            size="large"
            :auto-size="{ minRows: 1, maxRows: 5 }"
            @keydown="handleKeydownInTextarea"
            allow-clear
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
import { useKeyRespectKeymap } from '~/composables/useKeyRespectKeymap';
import { useScrollOverflow } from '~/composables/useScrollOverflow';
import { CollectionIndexWithAll, Session } from '~/plugins/tauri/bindings';
import { useAppSettingsStore } from '~/store/appSettingsStore';
import { SessionProfile } from '~/store/sessions';
import { allCompletionChainModes, allCompletionModels } from '~/types';
import { runChain } from '~/utils/completionChains';
import { createEmbeddings } from '~/utils/embeddings';
import { createVectorstore } from '~/utils/vectorstores';

const props = defineProps<{
  /**
   * The collection index that will be used to search for context when chatting
   * in this session.
   */
  collectionIndex: CollectionIndexWithAll;
  /**
   * The session data from the database, including conversation history, etc.
   */
  session: Session;
  /**
   * The session profile from the cache, which contains custom settings for this
   * session, i.e. completion chain mode, completion model, etc.
   */
  sessionProfile: SessionProfile;
}>();
const { collectionIndex, session } = props;
const sessionProfile = toRef(props, 'sessionProfile');

const { $tauriCommands } = useNuxtApp();

/**
 * The question input from the user.
 */
const questionInput = ref('');

/**
 * Whether the chat session is currently completing a question.
 */
const isCompleting = ref(false);

/**
 * Conversation update counter, used to trigger auto scroll to end.
 */
const conversationUpdated = ref(0);

/**
 * Whether the chat session should auto scroll to end.
 */
const autoScrollToEnd = ref(false);

/**
 * The app settings store.
 */
const appSettingsStore = useAppSettingsStore();

const { appSettings } = storeToRefs(appSettingsStore);

/**
 * The chat conversation.
 */
const conversation = ref<UiChatConversation>(
  new UiChatConversation(new SystemChatMessage('You are an assistant and going to help my to summary documents.')),
);

const questionHistoryOptions = ref<string[] | undefined>(undefined);
const questionCursor = ref(-1);

const availableChainModeOptions = computed(() => {
  return allCompletionChainModes[sessionProfile.value.completionConfig.client] || [];
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
  /**
   * The collection index settings from the database.
   */
  collectionIndex: CollectionIndexWithAll;
  /**
   * The vector store that will be used to search for context.
   */
  vectorstore: VectorStore;
  /**
   * The embedding client that has been used to embedding context and will be
   * used to embedding questions.
   */
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
  // watch the scroll status of the conversation container
  const conversationContainerEl = document.getElementById('content');
  if (conversationContainerEl) {
    useScrollOverflow(conversationContainerEl, 20, autoScrollToEnd);
  }

  await Promise.resolve()
    .then(async () => {
      await appSettingsStore.load();
      loadConversationHistory();
    })
    .then(() => {
      // scroll to end when the conversation is loaded
      setTimeout(enableAutoScrollToEnd, 400);
    })
    .catch((e: any) => {
      message.error(`Failed to load session data: ${errToString(e)}`);
    });
});

function enableAutoScrollToEnd() {
  autoScrollToEnd.value = true;
  scrollToEnd();
}

function scrollToEnd() {
  ++conversationUpdated.value;
}

/**
 * Load the conversation history from the database.
 */
function loadConversationHistory() {
  conversation.value.dialogues = UiChatDialogue.loadArray(session.history);
}

/**
 * Save the conversation history to the database.
 */
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
  const latestInput = questionInput.value;
  if (!latestInput) return;
  questionInput.value = '';

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
  const { type, key } = useKeyRespectKeymap(e);
  switch (type) {
    case 'edit':
      clearQuestionHistoryCursor();
      return;
    case 'move':
      switch (key) {
        case 'ArrowUp':
          e.preventDefault();
          return equipPrevHistoryQuestion(e);
        case 'ArrowDown':
          e.preventDefault();
          return equipNextHistoryQuestion(e);
      }
      return;
    case 'modifier':
      return;
  }

  // noinspection JSDeprecatedSymbols
  if (!e.shiftKey && e.keyCode === 13) {
    clearQuestionHistoryCursor();
    requestChatCompletion();
    e.preventDefault();
  }
}

/**
 * Equip the previous history question.
 */
function equipPrevHistoryQuestion(e: KeyboardEvent) {
  return equipHistoryQuestion(e, -1);
}

/**
 * Equip the next history question.
 */
function equipNextHistoryQuestion(e: KeyboardEvent) {
  return equipHistoryQuestion(e, +1);
}

function clearQuestionHistoryCursor() {
  questionHistoryOptions.value = undefined;
  questionCursor.value = -1;
}

/**
 * Equip the previous/next history question.
 */
function equipHistoryQuestion(e: KeyboardEvent, offset: number) {
  if (!questionHistoryOptions.value) {
    // initialize the history options by filtering the current input
    const currInput = questionInput.value;
    questionHistoryOptions.value = conversation.value.dialogues
      .map((d) => d.question.message.text)
      .filter((q) => q.toLowerCase().indexOf(currInput.toLowerCase()) >= 0);
    questionHistoryOptions.value.push(currInput);
    questionCursor.value = questionHistoryOptions.value.length - 1;
  }

  // move the cursor
  const n = questionHistoryOptions.value.length;
  questionCursor.value = (questionCursor.value + offset + n) % n;
  questionInput.value = questionHistoryOptions.value.at(questionCursor.value) || '';

  // move the cursor to the end
  (e.currentTarget as HTMLTextAreaElement).setSelectionRange(questionInput.value.length, questionInput.value.length);
}
</script>

<style lang="sass">
// center the clear icon in the input
.ant-input-clear-icon
  top: 13px !important

.ant-select-selection-item
  display: flex
  flex-direction: row
  align-items: center
</style>
