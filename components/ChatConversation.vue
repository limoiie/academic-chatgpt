<template>
  <a-list :data-source="conversation.dialogues">
    <!--suppress VueUnrecognizedSlot -->
    <template #renderItem="{ item }">
      <a-list-item>
        <ChatMessage :value="item.question" :error="undefined" />
      </a-list-item>
      <!--suppress TypeScriptUnresolvedReference -->
      <a-list-item v-if="item.chosen_answer">
        <ChatMessage :value="item.chosen_answer" :error="item.error" />
      </a-list-item>
    </template>

    <template #footer>
      <div ref="chatBottom" class="h-12" />
    </template>
  </a-list>
</template>

<script lang="ts"></script>

<script setup lang="ts">
import { Ref } from 'vue';
import { UiChatConversation } from '~/composables/beans/Chats';

/// Bound view elements
const chatBottom: Ref<Element | undefined> = ref(undefined);

/// Define properties
const props = defineProps<{ scrollToEnd: boolean; conversation: UiChatConversation }>();
const { scrollToEnd, conversation } = props;

watch(toRef(props, 'scrollToEnd'), () => {
  chatBottom.value?.scrollIntoView({ behavior: 'smooth', block: 'end' });
});
</script>
