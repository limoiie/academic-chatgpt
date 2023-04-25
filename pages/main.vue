<!--suppress VueUnrecognizedSlot -->
<template>
  <a-layout id="main" class="!min-h-screen">
    <!--suppress TypeScriptValidateTypes -->
    <a-layout-sider id="sider" class="overflow-scroll h-screen" v-model:collapsed="collapsed" collapsible>
      <div class="h-full flex flex-col">
        <div class="flex">
          <SideCollectionTree :collections="collections || []" />
        </div>
        <div id="spacer" class="flex-1 ant-menu-inline" />
        <a-menu-divider />
        <div id="settings" class="flex-shrink">
          <a-menu mode="inline" v-model:selectedKeys="selectedKeys" @focusout="handleMenuBlur">
            <a-menu-item key="preset" @click="navigateToPresetsPage">
              Presets
              <template #icon>
                <SettingOutlined />
              </template>
            </a-menu-item>
            <!--suppress TypeScriptUnresolvedReference -->
            <a-menu-item @click="toggleColorMode">
              {{ upperFirst(colorMode) }}
              <template #icon>
                <ColorModeToggleIcon />
              </template>
            </a-menu-item>
            <a-menu-item key="repo">
              <a href="https://github.com/limoiie/academic-chatgpt" target="_blank">Github</a>
              <template #icon>
                <GithubOutlined />
              </template>
            </a-menu-item>
          </a-menu>
        </div>
      </div>
    </a-layout-sider>
    <a-layout-content class="overflow-scroll h-screen">
      <NuxtPage />
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
import { GithubOutlined, SettingOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { storeToRefs } from 'pinia';
import { upperFirst } from 'scule';
import { platform } from '@tauri-apps/api/os'
import { ref } from 'vue';
import ColorModeToggleIcon from '~/components/ColorModeToggleIcon.vue';
import { useAppSettingsStore } from '~/store/appSettingsStore';
import { useCollectionStore } from '~/store/collections';
import { useColorMode } from '@vueuse/core';

const collapsed = ref<boolean>(false);
const selectedKeys = ref([]);
const isLoading = ref<boolean>(false);

const appSettingsStore = useAppSettingsStore();
const collectionStore = useCollectionStore();
const { collections } = storeToRefs(collectionStore);
const { store: colorMode } = useColorMode();

onMounted(async () => {
  await hideScrollbarOnWindows();

  await Promise.resolve((isLoading.value = true))
    .then(async () => {
      await appSettingsStore.load();
      await collectionStore.load();
    })
    .then(() => {
      navigateTo('/main/collections');
    })
    .catch((e) => {
      message.error(`Failed to load profiles: ${errToString(e)}`);
    })
    .finally(() => (isLoading.value = false));
});

function navigateToPresetsPage() {
  navigateTo('/presets');
}

function handleMenuBlur() {
  selectedKeys.value = [];
}

function toggleColorMode() {
  switch (colorMode.value) {
    case 'light':
      colorMode.value = 'dark';
      break;
    case 'dark':
      colorMode.value = 'auto';
      break;
    default:
      colorMode.value = 'light';
      break;
  }
}

/**
 * Hide scrollbar on windows because it looks not that good.
 */
async function hideScrollbarOnWindows() {
  const p = await platform();
  if (p === 'win32') {
    useStyleTag(`::-webkit-scrollbar {
  display: none !important;
}`);
  }
}
</script>
