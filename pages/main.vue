<!--suppress VueUnrecognizedSlot -->
<template>
  <a-layout id="main" class="!min-h-screen">
    <!--suppress TypeScriptValidateTypes -->
    <a-layout-sider id="sider" :theme="$colorMode.value" v-model:collapsed="collapsed" collapsible>
      <div class="h-full flex flex-col">
        <div class="flex">
          <SideCollectionTree />
        </div>
        <div id="spacer" class="flex-1" />
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
    <a-layout-content>
      <NuxtPage />
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
import { BgColorsOutlined, CheckOutlined } from '@ant-design/icons-vue';
import { upperFirst } from 'scule';

const colorMode = useColorMode();
const collapsed = ref<boolean>(false);
const selectedKeys = ref([]);

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