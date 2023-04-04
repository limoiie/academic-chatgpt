<template>
  <div id="component" class="w-full h-full flex flex-col items-stretch flex-1 relative overflow-hidden">
    <a-layout-header id="chat-header" :class="$colorMode.value">Academic ChatGPT</a-layout-header>
    <div id="content" class="flex flex-col items-center flex-[1_1_0] overflow-auto">
      <ChatConversation class="w-5/6 max-w-4xl !m-8" :conversation="conversation" :scroll-to-end="scrollToEnd" />
    </div>
    <div id="placeholder" class="w-full h-24"></div>
    <div id="footer" class="w-full bottom-0 left-0 px-12 py-6 absolute rounded">
      <a-input-search
        v-model:value="input"
        :loading="generating"
        placeholder="Input message"
        size="large"
        allow-clear
        show-count
        @search="requestChatCompletion"
      >
        <template #enterButton>
          <SendOutlined></SendOutlined>
        </template>
      </a-input-search>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SendOutlined } from '@ant-design/icons-vue';
import { SystemChatMessage } from 'langchain/schema';
import { PineconeStore } from 'langchain/vectorstores';
import { ref } from 'vue';
import { stringify } from 'yaml';
import { UiChatConversation } from '~/composables/beans/Chats';
import { makeChain } from '~/utils/qachain';

/// State variables
const input = ref('');
const generating = ref(false);
const scrollToEnd = ref(false);

const conversation = ref<UiChatConversation>(
  new UiChatConversation(new SystemChatMessage('You are an assistant and going to help my coding.')),
);

// noinspection JSUnusedGlobalSymbols
const { $pinecone, $openaiEmbeddings } = useNuxtApp();

async function onTokenStream(token: string) {
  // get the latest dialogue and update the AI message
  const dialogue = conversation.value.dialogues.at(-1);
  if (dialogue) {
    dialogue.answering.message.text += token;
  }
}

async function requestChatCompletion(latestInput: string) {
  if (latestInput) {
    const pineconeIndexName = 'test-index';
    const pineconeNamespace = 'debug-dojo';
    const index = $pinecone.Index(pineconeIndexName);

    // create vectorstore
    const vectorstore = await PineconeStore.fromExistingIndex($openaiEmbeddings, {
      pineconeIndex: index,
      namespace: pineconeNamespace,
      textKey: 'text',
    });
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
    } catch (e) {
      console.error('Failed to get response from openai: %s', stringify(e));
      await dialogue.failedToAnswer(e);
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
</script>

<style lang="sass">
.ant-layout-header.dark
  color: white
  background: #001529

.ant-layout-header.light
  color: black
  background: white

pre code.hljs
  border-radius: 4px
</style>
