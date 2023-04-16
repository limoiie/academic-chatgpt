<template>
  <div class="h-full flex flex-col">
    <div v-if="isLoading">
      <a-spin :spinning="isLoading" />
    </div>
    <a-tabs
      id="chatSessions"
      v-model:activeKey="activeSessionId"
      class="flex flex-1"
      type="editable-card"
      @edit="onEditSession"
    >
      <a-tab-pane v-for="session in sessions" :key="session.key" :tab="session.title" :closable="session.closable">
        <!--suppress TypeScriptUnresolvedReference -->
        <ChatSession
          v-if="data?.collectionOnIndex"
          :session="session.origin"
          :collection-on-index="data?.collectionOnIndex!"
        />
      </a-tab-pane>
    </a-tabs>
    <div v-if="hasNoSession" class="w-full h-full flex flex-row items-center">
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
const isLoading = ref<boolean>(false);

const route = useRoute();
const collectionId = parseInt(route.params['id'] as string);
const indexId = parseInt(route.params['indexId'] as string);

const collectionStore = useCollectionStore();
const { data } = useAsyncData(`sessionsDataOfCollection#${collectionId}Index#${indexId}`, async () => {
  return await Promise.resolve((isLoading.value = true))
    .then(() => collectionStore.load())
    .then(async () => {
      const index = collectionStore.getCollectionOnIndexProfileById(collectionId, indexId);
      if (!index) {
        throw new Error('Collection not found');
      }

      const chatSessions = await getSessionsByCollectionOnIndexId(index.id);
      return {
        collectionOnIndex: index,
        chatSessions: chatSessions,
      };
    })
    .catch((e) => {
      message.error(`Failed to load index profile: ${e}, jump to manage page.`);
      navigateTo(`/main/collections/${collectionId}/manage`);
      return null;
    })
    .finally(() => (isLoading.value = false));
});

const activeSessionId = ref<number | undefined>(undefined);
const hasNoSession = computed(() => !data.value?.chatSessions.length);
const sessions = computed(() => {
  if (!data.value?.chatSessions.length) {
    return [];
  }
  return (
    data.value.chatSessions.map((session) => {
      return { key: session.id, title: session.name, origin: session };
    }) || []
  );
});
watch(sessions, (newSessions) => {
  if (!newSessions.length) {
    activeSessionId.value = undefined;
  } else if (activeSessionId.value == null) {
    activeSessionId.value = newSessions[0].key;
  }
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
  if (!data.value) {
    return;
  }

  const chatSession = await createSession({
    indexProfileId: data.value.collectionOnIndex.id,
    name: uniqueName(
      'Chat',
      sessions.value.map((s) => s.title),
    ),
    history: '{}',
  });
  data.value.chatSessions = [...(data.value.chatSessions || []), chatSession];
  activeSessionId.value = chatSession.id;
}

/**
 * Delete a session and its binding tab by id.
 *
 * If the session is the active one, switch to the previous one.
 */
async function removeSession(targetSessionId: number) {
  if (!data.value) {
    return;
  }

  const sessions = data.value?.chatSessions;
  if (sessions && sessions.length) {
    let currTabIndex = sessions.findIndex((session) => session.id === targetSessionId);
    if (currTabIndex >= 0) {
      await deleteSessionById(targetSessionId);
      data.value.chatSessions = sessions.filter((session) => session.id !== targetSessionId);
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
  if (!data.value) {
    return;
  }

  const sessions = data.value.chatSessions;
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
