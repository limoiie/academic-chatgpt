<template>
  <a-list :data-source="logs" ref="vLogs" bordered>
    <!--suppress VueUnrecognizedSlot -->
    <template #renderItem="{ item }">
      <a-list-item>
        <!--suppress TypeScriptUnresolvedReference -->
        <pre>{{ item.level }}: {{ item.message }}</pre>
      </a-list-item>
    </template>

    <!--suppress VueUnrecognizedSlot -->
    <template #footer class="h-20" />
  </a-list>
</template>

<script setup lang="ts">
const { logs } = defineProps<{ logs: LogMessage[] }>();
</script>

<style lang="sass">
.ant-list-items
  padding: 8px 0 8px

li
  &.ant-list-item
    padding: 0

  pre
    margin-bottom: 0
</style>
