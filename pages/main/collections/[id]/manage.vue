<template>
  <a-layout>
    <a-page-header
      class="bg-white border-b-1 z-10"
      title="Manage"
      :sub-title="`of collection ${collectionId.toString()}`"
      @back="() => $router.go(-1)"
    >
      <template #extra>
        <a-button key="delete" type="dashed" shape="circle" danger>
          <template #icon>
            <DeleteOutlined />
          </template>
        </a-button>
      </template>
    </a-page-header>

    <a-layout-content class="mx-6">
      <a-tabs v-model:activeKey="activeKey">
        <a-tab-pane key="main" tab="Main">
          <CollectionManageMain :id="collectionId" />
        </a-tab-pane>
        <a-tab-pane key="indexes" tab="Indexes" force-render></a-tab-pane>
      </a-tabs>
    </a-layout-content>
  </a-layout>
</template>

<script setup lang="ts">
import { DeleteOutlined } from '@ant-design/icons-vue';
import { ref } from 'vue';

const route = useRoute();
const collectionId = parseInt(route.params['id'] as string);
const activeKey = ref<'main' | 'indexes'>('main');
</script>
