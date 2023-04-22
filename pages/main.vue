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

            <a-menu-item @click="toggleColorMode">
              {{ upperFirst(appSettings.colorMode.value) }} Mode
              <template #icon>
                <!--<BgColorsOutlined />-->
                <svg
                  v-if="$colorMode.value === 'dark'"
                  xmlns="http://www.w3.org/2000/svg"
                  width="1em"
                  height="1em"
                  viewBox="0 0 21 21"
                >
                  <path
                    fill="currentColor"
                    d="M9.37 5.51A7.35 7.35 0 0 0 9.1 7.5c0 4.08 3.32 7.4 7.4 7.4c.68 0 1.35-.09 1.99-.27A7.014 7.014 0 0 1 12 19c-3.86 0-7-3.14-7-7c0-2.93 1.81-5.45 4.37-6.49z"
                    opacity=".3"
                  />
                  <path
                    fill="currentColor"
                    d="M9.37 5.51A7.35 7.35 0 0 0 9.1 7.5c0 4.08 3.32 7.4 7.4 7.4c.68 0 1.35-.09 1.99-.27A7.014 7.014 0 0 1 12 19c-3.86 0-7-3.14-7-7c0-2.93 1.81-5.45 4.37-6.49zM12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26a5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"
                  />
                </svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 21 21">
                  <circle cx="12" cy="12" r="3" fill="currentColor" opacity=".3" />
                  <path
                    fill="currentColor"
                    d="M12 9c1.65 0 3 1.35 3 3s-1.35 3-3 3s-3-1.35-3-3s1.35-3 3-3m0-2c-2.76 0-5 2.24-5 5s2.24 5 5 5s5-2.24 5-5s-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0a.996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0a.996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41a.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41a.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"
                  />
                </svg>
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
import { SettingOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { storeToRefs } from 'pinia';
import { upperFirst } from 'scule';
import { ref } from 'vue';
import { useAppSettingsStore } from '~/store/appSettingsStore';
import { useCollectionsStore } from '~/store/collections';

const collapsed = ref<boolean>(false);
const selectedKeys = ref([]);
const isLoading = ref<boolean>(false);

const appSettingsStore = useAppSettingsStore();
const collectionStore = useCollectionsStore();
const { appSettings } = storeToRefs(appSettingsStore);
const { collections } = storeToRefs(collectionStore);

await Promise.resolve((isLoading.value = true))
  .then(async () => {
    await appSettingsStore.load();
    await collectionStore.load();
  })
  .catch((e) => {
    message.error(`Failed to load profiles: ${errToString(e)}`);
  })
  .finally(() => (isLoading.value = false));

function navigateToPresetsPage() {
  navigateTo('/presets');
}

function handleMenuBlur() {
  selectedKeys.value = [];
}

function toggleColorMode() {
  appSettings.value.colorMode.value = appSettings.value.colorMode.value === 'dark' ? 'light' : 'dark';
}

navigateTo('/main/collections');
</script>

<style lang="sass">
.ant-menu-item
  display: flex
  flex-direction: row
  align-items: center
</style>
