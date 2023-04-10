<template>
  <div class="h-full flex flex-col">
    <a-tabs v-model:activeKey="activeSessionId" class="flex flex-1" type="editable-card" @edit="onEdit">
      <a-tab-pane v-for="session in sessions" :key="session.key" :tab="session.title" :closable="session.closable">
        <ChatSession v-if="indexProfile" :session="session.origin" :index-profile="indexProfile!" />
      </a-tab-pane>
    </a-tabs>
    <div class="w-full flex flex-row items-center" v-if="hasNoSession">
      <a-empty class="w-full mb-32!">
        <template #description>
          <span> No session yet </span>
        </template>
        <a-button type="primary" @click="add">Create Now</a-button>
      </a-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useAsyncData } from '#app';
import { createSession, getIndexProfileById, getSessions } from '~/utils/bindings';

const route = useRoute();
const indexProfileId = parseInt(route.params['indexId'] as string);
const { data: indexProfile } = useAsyncData('indexProfile', async () => {
  return await getIndexProfileById(indexProfileId);
});

const newTabIndex = ref(0);
const activeSessionId = ref<number | undefined>(undefined);

const sessions = ref<{ title: string; key: number }[]>([]);
const { data: chatSessions } = useAsyncData('chatSessions', async () => {
  return (await getSessions())
    .filter((session) => session.collectionProfileId === indexProfileId)
    .filter((session) => {
      newTabIndex.value = Math.max(newTabIndex.value, parseTabIndex(session.name));
      return session.collectionProfileId == indexProfileId;
    });
});
const hasNoSession = computed(() => !chatSessions.value?.length);
watch(chatSessions, (newChatSessions) => {
  if (!newChatSessions?.length) {
    sessions.value = [];
    activeSessionId.value = undefined;
    return;
  }
  sessions.value =
    newChatSessions.map((session) => {
      return { key: session.id, title: session.name, origin: session };
    }) || [];
  if (!activeSessionId.value) {
    activeSessionId.value = newChatSessions[0].id;
  }
});

function parseTabIndex(tabName: string) {
  return tabName.startsWith('Chat-') ? parseInt(tabName.substring(5)) : 0;
}

async function switchTo(tabIndex: number) {
  const sessions = chatSessions.value;
  if (sessions && sessions.length) {
    const safeTabIndex = tabIndex >= 0 && sessions.length > tabIndex ? tabIndex : 0;
    activeSessionId.value = sessions[safeTabIndex].id;
  }
}

async function add() {
  const tabIndex = ++newTabIndex.value;
  const title = tabIndex == 1 ? 'Chat' : 'Chat-' + tabIndex.toString();
  const chatSession = await createSession({
    collection_profile_id: indexProfileId,
    name: title,
    history: '{}',
  });
  chatSessions.value = [...(chatSessions.value || []), chatSession];
  activeSessionId.value = chatSession.id;
}

async function remove(targetSessionId: number) {
  const sessions = chatSessions.value;
  if (sessions && sessions.length) {
    let currTabIndex = sessions.findIndex((session) => session.id === targetSessionId);
    if (currTabIndex >= 0) {
      await deleteSessionById(targetSessionId);
      chatSessions.value = sessions.filter((session) => session.id !== targetSessionId);
      if (activeSessionId.value === targetSessionId) {
        await switchTo(currTabIndex - 1);
      }
    }
  }
}

const onEdit = (targetSessionId: number | MouseEvent, action: string) => {
  if (action === 'add') {
    add();
  } else {
    remove(targetSessionId as number);
  }
};
</script>

<style lang="sass">
.ant-tabs-content
  height: 100%

.ant-tabs-nav
  margin-bottom: 2px !important

.ant-tabs-nav-wrap
  height: 42px

.ant-tabs-tab
  border: 0 !important

button.ant-tabs-tab-remove, .ant-tabs-tab-btn
  height: 18px
</style>
