<template>
  <div class="w-full h-full flex">
    <div v-if="isLoading" class="m-auto flex flex-col">
      <div class="flex flex-col items-center">
        <a-spin class="m-auto!" :spinning="isLoading" />
        <div>Loading sessions...</div>
      </div>
    </div>
    <div v-else-if="!hasSession" class="w-full h-full flex flex-row items-center">
      <a-empty class="w-full mb-24! flex flex-col items-center">
        <template #description>
          <span> No session yet </span>
        </template>
        <a-button type="primary" @click="addSession">Create Now</a-button>
      </a-empty>
    </div>
    <a-layout v-else class="flex flex-col flex-1">
      <a-page-header class="bg-white border-b-1 z-10" title="Chat" @back="() => $router.go(-1)">
        <template #subTitle>
          <a-button
            v-show="isSessionNameChanged"
            shape="circle"
            size="small"
            :disabled="!isSessionNameChanged"
            :loading="isUpdatingName"
            @click="tryUpdateSessionName"
          >
            <template #icon>
              <EditOutlined />
            </template>
          </a-button>
          <a-input
            ref="viewCollectionName"
            v-model:value="formState.name"
            :bordered="false"
            placeholder="Collection Name"
          />
        </template>

        <template #extra>
          <a-tooltip title="Toggle tab bar">
            <a-button
              shape="circle"
              :type="showTabBar ? 'dashed' : 'primary'"
              @click="() => (showTabBar = !showTabBar)"
            >
              <template #icon>
                <BarsOutlined />
              </template>
            </a-button>
          </a-tooltip>
        </template>
      </a-page-header>
      <a-tabs
        id="chatSessions"
        v-model:activeKey="activeSessionId"
        class="flex flex-1"
        type="editable-card"
        @edit="onEditSession"
      >
        <!--suppress VueUnrecognizedSlot -->
        <template v-if="!showTabBar" #renderTabBar></template>
        <!--suppress VueUnrecognizedSlot -->
        <template #addIcon>
          <PlusCircleOutlined />
        </template>
        <a-tab-pane
          v-for="session in sessionsUiData"
          :key="session.key"
          :tab="session.title"
          :closable="session.closable"
        >
          <!--suppress VueUnrecognizedSlot -->
          <template v-if="true" #closeIcon>
            <CloseOutlined class="group-hover:bg-orange-400" />
          </template>

          <!--suppress TypeScriptUnresolvedReference -->
          <ChatSession
            v-if="data?.collectionIndex"
            :collection-index="data?.collectionIndex!"
            :session="session.origin"
            :session-profile="session.profile"
          />
        </a-tab-pane>
      </a-tabs>
    </a-layout>
  </div>
</template>

<script setup lang="ts">
import { BarsOutlined, CloseOutlined, EditOutlined, PlusCircleOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { reactive } from 'vue';
import { useCollectionsStore } from '~/store/collections';
import { useSessionsStore } from '~/store/sessions';
import { uniqueName } from '~/utils/strings';

const isLoading = ref<boolean>(false);
const isUpdatingName = ref<boolean>(false);
const isSessionNameChanged = computed(() => {
  return activeSession.value?.name != formState.name;
});
const showTabBar = ref<boolean>(true);

const route = useRoute();
const collectionId = parseInt(route.params['id'] as string);
const indexId = parseInt(route.params['indexId'] as string);

const { $tauriCommands } = useNuxtApp();

const sessionsStore = useSessionsStore();
const collectionStore = useCollectionsStore();
const { data } = useAsyncData(`sessionsDataOfCollection#${collectionId}Index#${indexId}`, async () => {
  return await Promise.resolve((isLoading.value = true))
    .then(async () => {
      await sessionsStore.load();
      await collectionStore.load();
    })
    .then(async () => {
      const index = collectionStore.getCollectionIndexById(collectionId, indexId);
      if (!index) {
        throw new Error('Collection not found');
      }

      const chatSessions = await $tauriCommands.getSessionsByIndexId(index.id);
      return {
        collectionIndex: index,
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

const activeSessionId = sessionsStore.getActiveSessionId(collectionId, indexId);
const activeSession = computed(() => {
  if (!data.value?.chatSessions.length) {
    return undefined;
  }
  const session = data.value.chatSessions.find((session) => session.id === activeSessionId.value);
  formState.name = session?.name || '';
  return session;
});
const hasSession = computed(() => data.value?.chatSessions.length);
const sessionsUiData = computed(() => {
  if (!data.value?.chatSessions.length) {
    return [];
  }
  return (
    data.value.chatSessions.map((session) => {
      return {
        key: session.id,
        title: session.name,
        origin: session,
        profile: sessionsStore.getSessionProfile(session.id),
      };
    }) || []
  );
});
const sessionNames = computed(() => {
  if (!data.value?.chatSessions.length) {
    return [];
  }
  return data.value.chatSessions.map((session) => session.name);
});
watch(sessionsUiData, (newSessions) => {
  if (!newSessions.length) {
    activeSessionId.value = undefined;
  } else if (activeSessionId.value == null) {
    activeSessionId.value = newSessions[0].key;
  }
});

interface FormState {
  name: string;
}

const formState = reactive<FormState>({
  name: '',
});

/**
 * Update session name
 */
async function tryUpdateSessionName() {
  const session = activeSession.value;
  if (!session) {
    message.error('No session selected!');
    return;
  }

  if (sessionNames.value.includes(formState.name)) {
    message.error('Failed to update name: already existing!');
    return;
  }

  await Promise.resolve((isUpdatingName.value = true))
    .then(() =>
      $tauriCommands.updateSession({
        id: session.id,
        name: formState.name,
        history: null,
      }),
    )
    .then(async (data) => {
      session.name = data.name;
      message.info(`Updated name as '${data.name}'`);
    })
    .catch((e) => {
      message.error(`Failed to update name: ${errToString(e)}`);
    })
    .finally(() => {
      isUpdatingName.value = false;
    });
}

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

  // noinspection TypeScriptValidateJSTypes
  const chatSession = await $tauriCommands.createSession({
    indexId: data.value.collectionIndex.id,
    name: uniqueName('Chat', sessionNames.value),
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
      await $tauriCommands.deleteSessionById(targetSessionId);
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

  // fix the tab text & button align issue
  .ant-tabs-tab
    display: flex !important
    align-items: flex-start !important
    border-top: 0
    border-left: 0
    border-radius: 0

  // fix the blinking issue when switching tabs
  .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn
    text-shadow: 0 0 1px currentcolor

  // fix the tab add button align issue
  button.ant-tabs-nav-add
    display: flex !important
    align-items: center !important
    justify-content: center !important
    background: transparent !important
    border: 0 !important
    margin-top: 12px
    margin-bottom: 12px
</style>
