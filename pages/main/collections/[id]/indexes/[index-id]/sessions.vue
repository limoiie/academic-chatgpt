<template>
  <div class="bg-white h-full flex flex-col">
    <a-tabs v-model:activeKey="activeKey" class="flex flex-1" type="editable-card" @edit="onEdit">
      <a-tab-pane v-for="session in sessions" :key="session.key" :tab="session.title" :closable="session.closable">
        <NuxtPage page-key="static" />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<script setup lang="ts">
import { useAsyncData } from '#app';
import { message } from 'ant-design-vue';
import { getIndexProfileById } from '~/utils/bindings';

const route = useRoute();
const basePath = route.path;
message.info('enter ' + basePath);

const indexId = parseInt(route.params['index-id'] as string);
const { data: indexProfile } = useAsyncData('indexProfile', async () => {
  return await getIndexProfileById(indexId);
});

const sessions = ref<{ title: string; key: number }[]>([
  { title: 'Tab 1', key: 1 },
  { title: 'Tab 2', key: 2 },
  { title: 'Tab 3', key: 3 },
]);

const activeKey = ref(sessions.value[0].key);
watch(activeKey, (newKey) => {
  navigateTo(basePath + `/${newKey}`);
});

const newTabIndex = ref(3);

const add = () => {
  activeKey.value = ++newTabIndex.value;
  sessions.value.push({ title: 'New Tab', key: activeKey.value });
};

const remove = (targetKey: number) => {
  let lastIndex = 0;
  sessions.value.forEach((session, i) => {
    if (session.key === targetKey) {
      lastIndex = i - 1;
    }
  });
  sessions.value = sessions.value.filter((session) => session.key !== targetKey);
  if (sessions.value.length && activeKey.value === targetKey) {
    if (lastIndex >= 0) {
      activeKey.value = sessions.value[lastIndex].key;
    } else {
      activeKey.value = sessions.value[0].key;
    }
  }
};

const onEdit = (targetKey: number | MouseEvent, action: string) => {
  if (action === 'add') {
    add();
  } else {
    remove(targetKey as number);
  }
};
</script>

<style lang="sass">
.ant-tabs-content
  height: 100%
</style>