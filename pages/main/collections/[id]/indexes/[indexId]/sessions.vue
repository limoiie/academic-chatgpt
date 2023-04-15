<template>
  <div class="h-full flex flex-col">
    <a-tabs
      id="chatSessions"
      v-if="activeSessionId"
      v-model:activeKey="activeSessionId"
      class="flex flex-1"
      type="editable-card"
      @edit="onEditSession"
    >
      <a-tab-pane v-for="session in sessions" :key="session.key" :tab="session.title" :closable="session.closable">
        <ChatSession v-if="collectionOnIndex" :session="session.origin" :collection-on-index="collectionOnIndex!" />
      </a-tab-pane>
    </a-tabs>
    <div class="w-full h-full flex flex-row items-center" v-if="hasNoSession">
      <a-empty class="w-full mb-24! flex flex-col items-center">
        <template #description>
          <span> No session yet </span>
        </template>
        <a-button type="primary" @click="addSession">Create Now</a-button>
      </a-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAsyncData } from '#app';
import { message } from 'ant-design-vue';
import { useCollectionStore } from '~/store/collections';
import { createSession, getSessionsByCollectionOnIndexId } from '~/utils/bindings';
import { uniqueName } from '~/utils/strings';

const route = useRoute();
const collectionId = parseInt(route.params['id'] as string);
const indexId = parseInt(route.params['indexId'] as string);

const collectionStore = useCollectionStore();
const { data: collectionOnIndex } = useAsyncData('collectionOnIndex', async () => {
  return await collectionStore
    .load()
    .then(() => {
      const index = collectionStore.getCollectionOnIndexProfileById(collectionId, indexId);
      if (!index) {
        throw new Error('Collection not found');
      }
      return index;
    })
    .catch((e) => {
      message.error(`Failed to load index profile: ${e}, jump to manage page.`);
      navigateTo(`/main/collections/${collectionId}/manage`);
    });
});

const activeSessionId = ref<number | undefined>(undefined);
const { data: chatSessions } = useAsyncData('chatSessions', async () => {
  return collectionOnIndex.value ? await getSessionsByCollectionOnIndexId(collectionOnIndex.value?.id) : null;
});
const hasNoSession = computed(() => !chatSessions.value?.length);
const sessions = computed(() => {
  if (!chatSessions.value?.length) {
    activeSessionId.value = undefined;
    return [];
  }
  if (!activeSessionId.value) {
    activeSessionId.value = chatSessions.value[0].id;
  }
  return (
    chatSessions.value.map((session) => {
      return { key: session.id, title: session.name, origin: session };
    }) || []
  );
});

/**
 * Either delete or add a session tab according the given action.
 */
function onEditSession(targetSessionId: number | MouseEvent, action: string) {
  if (action !== 'add') {
    removeSession(targetSessionId as number);
  } else {
    addSession();
  }
}

/**
 * Create a new session, and allocate a new tab for it.
 */
async function addSession() {
  if (!collectionOnIndex.value) {
    return;
  }

  const chatSession = await createSession({
    indexProfileId: collectionOnIndex.value.id,
    name: uniqueName(
      'Chat',
      sessions.value.map((s) => s.title),
    ),
    history: '{}',
  });
  chatSessions.value = [...(chatSessions.value || []), chatSession];
  activeSessionId.value = chatSession.id;
}

/**
 * Delete a session and its binding tab by id.
 *
 * If the session is the active one, switch to the previous one.
 */
async function removeSession(targetSessionId: number) {
  const sessions = chatSessions.value;
  if (sessions && sessions.length) {
    let currTabIndex = sessions.findIndex((session) => session.id === targetSessionId);
    if (currTabIndex >= 0) {
      await deleteSessionById(targetSessionId);
      chatSessions.value = sessions.filter((session) => session.id !== targetSessionId);
      if (activeSessionId.value === targetSessionId) {
        await switchToSessionTabByIndex(currTabIndex - 1);
      }
    }
  }
}

/**
 * Switch to a session tab by index.
 */
async function switchToSessionTabByIndex(tabIndex: number) {
  const sessions = chatSessions.value;
  if (sessions && sessions.length) {
    const safeTabIndex = tabIndex >= 0 && sessions.length > tabIndex ? tabIndex : 0;
    activeSessionId.value = sessions[safeTabIndex].id;
  }
}
</script>

<style lang="sass">
#chatSessions
  .ant-tabs-content
    height: 100%

  .ant-tabs-nav
    margin-bottom: 0 !important

  .ant-tabs-nav-wrap
    height: 42px

  .ant-tabs-tab
    border: 0 !important

button.ant-tabs-tab-remove, .ant-tabs-tab-btn
  height: 18px
</style>
