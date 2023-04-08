<!--suppress VueUnrecognizedSlot -->
<template>
  <a-layout id="main" class="!min-h-screen">
    <!--suppress TypeScriptValidateTypes -->
    <a-layout-sider
      id="sider"
      class="overflow-scroll h-screen"
      :theme="$colorMode.value as 'dark' | 'light' "
      v-model:collapsed="collapsed"
      collapsible
    >
      <div class="h-full flex flex-col">
        <div class="flex">
          <SideCollectionTree :collections="collections || []" />
        </div>
        <div id="spacer" class="flex-1 ant-menu-inline" :class="{ 'ant-menu-dark': $colorMode.value == 'dark' }" />
        <a-menu-divider />
        <div id="settings" class="flex-shrink">
          <a-menu
            mode="inline"
            :theme="$colorMode.value"
            v-model:selectedKeys="selectedKeys"
            @click="handleMenuClick"
            @focusout="handleMenuBlur"
          >
            <a-sub-menu key="theme">
              <template #icon>
                <BgColorsOutlined />
              </template>
              <template #title> On {{ upperFirst($colorMode.value) }} Theme</template>
              <a-menu-item v-for="key of ['light', 'dark', 'system']" :key="key">
                {{ key }}
                <template #icon v-if="$colorMode.preference == key">
                  <CheckOutlined />
                </template>
              </a-menu-item>
            </a-sub-menu>
          </a-menu>
        </div>
      </div>
    </a-layout-sider>
    <a-layout-content class="overflow-scroll h-screen">
      <NuxtPage page-key="static" />
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
import { BgColorsOutlined, CheckOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { upperFirst } from 'scule';
import { ref } from 'vue';
import { CollectionWithProfiles, getCollectionsWithIndexProfiles } from '~/utils/bindings';

const colorMode = useColorMode();
const collapsed = ref<boolean>(false);
const selectedKeys = ref([]);
const isLoading = ref<boolean>(false);

const { data: collections } = useAsyncData('allCollections', async () => {
  isLoading.value = true;
  let collections: CollectionWithProfiles[] = [];
  try {
    collections = (await getCollectionsWithIndexProfiles()) || [];
  } catch (e) {
    message.error(`Failed to load profiles: ${e}`);
  }
  isLoading.value = false;

  navigate(collections);
  return collections;
});

function navigate(collections: CollectionWithProfiles[]) {
  const collection = collections[0];
  if (collection) {
    navigateTo(`/main/collections/${collection.id}`);
  } else {
    navigateTo(`/main/collections/create`);
  }
}

function handleMenuBlur() {
  selectedKeys.value = [];
}

function handleMenuClick(e: { key: string; keyPath: string[] }) {
  switch (e.keyPath[0]) {
    case 'theme':
      colorMode.preference = e.key;
      break;
  }
}
</script>

<style lang="sass">
.ant-menu-item
  display: flex
  flex-direction: row
  align-items: center
</style>
