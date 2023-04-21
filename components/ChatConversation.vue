<template>
  <a-list :data-source="conversation.dialogues">
    <!--suppress VueUnrecognizedSlot -->
    <template #renderItem="{ item }">
      <a-list-item>
        <ChatMessage :value="item.question" :error="undefined" />
      </a-list-item>
      <!--suppress TypeScriptUnresolvedReference -->
      <a-list-item v-if="item.chosenAnswer">
        <ChatMessage
          :value="item.chosenAnswer"
          :error="item.error"
          :answering="item.inAnswering"
          @stop-answering="onStopAnswering(item)"
        />
      </a-list-item>
    </template>

    <template #footer>
      <div ref="chatBottom" class="h-42" />
    </template>
  </a-list>
</template>

<script setup lang="ts">
import { Ref } from 'vue';
import { UiChatConversation, UiChatDialogue } from '~/composables/beans/Chats';

/// Bound view elements
const chatBottom: Ref<Element | undefined> = ref(undefined);

/// Define emits
const emits = defineEmits(['stopAnswering']);

/// Define properties
const props = defineProps<{
  /// increment this value to trigger a scroll to the end of the chat
  scrollToEnd: number;
  autoScrollToEnd: boolean;
  conversation: UiChatConversation;
}>();
const { conversation } = props;
const { scrollToEnd, autoScrollToEnd } = toRefs(props);

/// Scroll to the end of the chat when the last message changes or the scrollToEnd value changes
watch([scrollToEnd, () => conversation.dialogues.at(-1)?.chosenAnswer?.message.text], () => {
  if (autoScrollToEnd.value) {
    chatBottom.value?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
});

function onStopAnswering(item: UiChatDialogue) {
  emits('stopAnswering', item);
}
</script>
