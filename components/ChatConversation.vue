<template>
  <a-list :data-source="conversation.dialogues">
    <!-- Question -->
    <!--suppress VueUnrecognizedSlot -->
    <template #renderItem="{ item }">
      <a-list-item class="justify-center! hover:bg-[#e6f7ff] duration-300">
        <ChatMessage class="max-w-7xl" :value="item.question" :error="undefined">
          <template #avatar="{ username }">
            <CharacterAvatar class="w-10 h-10 bg-blue-400 text-white text-1.1em" :value="username" />
          </template>
        </ChatMessage>
      </a-list-item>
      <!-- Answering -->
      <!--suppress TypeScriptUnresolvedReference -->
      <a-list-item v-if="item.chosenAnswer" class="justify-center! bg-gray-50 hover:bg-[#e6f7ff] duration-300">
        <ChatMessage
          class="max-w-7xl"
          :value="item.chosenAnswer"
          :error="item.error"
          :answering="item.inAnswering"
          @stop-answering="onStopAnswering(item)"
        >
          <template #avatar="{ username }">
            <img src="@/assets/images/chatgpt-logo-pure.svg" class="w-10! h-10! bg-blue-200" :alt="username" />
          </template>
        </ChatMessage>
      </a-list-item>
    </template>

    <template #footer>
      <div ref="chatBottom" class="h-54" />
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

<style lang="sass">
.ant-list-footer
  padding: 0 !important
</style>