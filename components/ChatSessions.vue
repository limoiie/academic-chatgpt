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
    <a-layout v-else class="w-full flex flex-col flex-1">
      <a-page-header :title="collection.name || '--'">
        <template #subTitle>
          <div class="flex flex-row items-center">
            <a-button
              v-show="isSessionNameChanged"
              shape="circle"
              size="small"
              type="dashed"
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
              @input="onEditSessionName"
              @pressEnter="tryUpdateSessionName"
              placeholder="Collection Name"
            />
          </div>
        </template>

        <template #extra>
          <a-button v-if="showTabBar" shape="circle" @click="() => (showTabBarOnLeft = !showTabBarOnLeft)">
            <template #icon>
              <BorderLeftOutlined v-if="showTabBarOnLeft" />
              <BorderTopOutlined v-else />
            </template>
          </a-button>
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
        :tab-position="showTabBarOnLeft ? 'left' : 'top'"
        @edit="onEditSession"
      >
        <!--suppress VueUnrecognizedSlot -->
        <template v-if="!showTabBar" #renderTabBar></template>
        <!--suppress VueUnrecognizedSlot -->
        <template #addIcon>
          <PlusCircleOutlined />
        </template>
        <a-tab-pane v-for="session in sessionsUiData" :key="session.key" :closable="session.closable">
          <!--suppress VueUnrecognizedSlot -->
          <template #tab>
            <CommentOutlined />
            {{ session.title }}
          </template>

          <!--suppress VueUnrecognizedSlot -->
          <template v-if="true" #closeIcon>
            <CloseOutlined />
          </template>

          <!--suppress TypeScriptUnresolvedReference -->
          <ChatSession :index="index" :session="session.origin" :session-profile="session.profile" />
        </a-tab-pane>
      </a-tabs>
    </a-layout>
  </div>
</template>

<script setup lang="ts">
import {
  BarsOutlined,
  BorderLeftOutlined,
  BorderTopOutlined,
  CloseOutlined,
  CommentOutlined,
  EditOutlined,
  PlusCircleOutlined,
} from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { reactive, ref, toRefs } from 'vue';
import { Collection, CollectionIndexWithAll } from '~/plugins/tauri/bindings';
import { useSessionStore } from '~/store/sessions';
import { uniqueName } from '~/utils/strings';

const props = defineProps<{
  collection: Collection;
  index: CollectionIndexWithAll;
}>();
const { collection, index } = toRefs(props);

const isLoading = ref<boolean>(false);
const isUpdatingName = ref<boolean>(false);
const isSessionNameChanged = ref<boolean>(false);
const showTabBar = ref<boolean>(true);
const showTabBarOnLeft = ref<boolean>(false);

const collectionId = index.value.collectionId;
const indexId = index.value.indexId;

const { $tauriCommands } = useNuxtApp();

const sessionStore = useSessionStore();
const { data: chatSessions } = useAsyncData(`sessionsDataOfCollection#${collectionId}Index#${indexId}`, async () => {
  return await Promise.resolve((isLoading.value = true))
    .then(async () => await sessionStore.load())
    .then(async () => {
      return await $tauriCommands.getSessionsByIndexId(index.value.id);
    })
    .catch((e) => {
      message.error(`Failed to load index profile: ${e}, jump to manage page.`);
      navigateTo(`/main/collections/${collectionId}/manage`);
      return null;
    })
    .finally(() => (isLoading.value = false));
});

interface FormState {
  name: string;
}

const formState = reactive<FormState>({
  name: '',
});

const activeSessionId = sessionStore.getActiveSessionId(collectionId, indexId);
// update the active session when the active session id changed by selecting on the tab bar
const activeSession = computed(() => {
  if (!chatSessions.value?.length) {
    return undefined;
  }
  const session = chatSessions.value.find((session) => session.id === activeSessionId.value);
  formState.name = session?.name || '';
  return session;
});
// update the session name on the top bar when active session changed
watch(activeSession, (session) => {
  formState.name = session?.name || '';
});

const hasSession = computed(() => chatSessions.value?.length);
const sessionsUiData = computed(() => {
  if (!chatSessions.value?.length) {
    return [];
  }
  return (
    chatSessions.value.map((session) => {
      return {
        key: session.id,
        title: session.name,
        origin: session,
        profile: sessionStore.getSessionProfile(session.id),
      };
    }) || []
  );
});
const sessionNames = computed(() => {
  if (!chatSessions.value?.length) {
    return [];
  }
  return chatSessions.value.map((session) => session.name);
});
watch(sessionsUiData, (newSessions) => {
  if (!newSessions.length) {
    activeSessionId.value = undefined;
  } else if (activeSessionId.value == null) {
    activeSessionId.value = newSessions[0].key;
  }
});

/**
 * Update status when name changed.
 */
function onEditSessionName() {
  isSessionNameChanged.value = activeSession.value?.name != formState.name;
}

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
      message.info(`Updated name as '${data.name}'`, 0.6);
    })
    .catch((e) => {
      message.error(`Failed to update name: ${errToString(e)}`, 0.6);
    })
    .finally(() => {
      isUpdatingName.value = false;
      onEditSessionName();
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
 * Create a new session and allocate a new tab for it.
 */
async function addSession() {
  await Promise.resolve()
    .then(async () => {
      if (!chatSessions.value) {
        return;
      }

      // noinspection TypeScriptValidateJSTypes
      const chatSession = await $tauriCommands.createSession({
        indexId: index.value.id,
        name: uniqueName('Chat', sessionNames.value),
        history: '{}',
      });
      chatSessions.value = [...(chatSessions.value || []), chatSession];
      activeSessionId.value = chatSession.id;
    })
    .catch((e) => {
      message.error(`Failed to create session: ${errToString(e)}`);
    });
}

/**
 * Delete a session and its binding tab by id.
 *
 * If the session is the active one, switch to the previous one.
 */
async function removeSession(targetSessionId: number) {
  if (!chatSessions.value) {
    return;
  }

  const sessions = chatSessions.value;
  let currTabIndex = sessions.findIndex((session) => session.id === targetSessionId);
  if (currTabIndex >= 0) {
    await sessionStore.deleteSession(targetSessionId);
    chatSessions.value = sessions.filter((session) => session.id !== targetSessionId);
    if (activeSessionId.value === targetSessionId) {
      await switchToSessionTabByIndex(currTabIndex);
    }
  }
}

/**
 * Switch to a session tab by index.
 */
async function switchToSessionTabByIndex(tabIndex: number) {
  if (!chatSessions.value) {
    return;
  }

  const sessions = chatSessions.value;
  if (sessions && sessions.length) {
    const safeTabIndex = Math.min(tabIndex, sessions.length - 1);
    activeSessionId.value = sessions[safeTabIndex].id;
  }
}
</script>

<style lang="sass">
#chatSessions
  .ant-tabs-tab:not(.ant-tabs-tab-active)
    background: transparent !important

  .ant-tabs-tab.ant-tabs-tab-active
    border-bottom-color: #1890ff !important
    border-bottom-width: 2px !important
    transition-duration: 100ms !important

  .dark
    &.ant-tabs-tab.ant-tabs-tab-active
      background: black !important

  .ant-tabs-content
    height: 100%

  .ant-tabs-nav
    margin-bottom: 0 !important

  &.ant-tabs-left
    .ant-tabs-nav
      width: 120px
      margin-right: 0 !important
      margin-bottom: 8px !important

    .ant-tabs-tabpane
      padding-left: 0 !important

  // fix the tab text & button align issue
  .ant-tabs-tab
    display: flex !important
    align-items: flex-start !important
    border-top: 0
    border-left: 0
    border-radius: 0

  .ant-tabs-tab-btn
    display: flex !important
    align-items: center !important

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
