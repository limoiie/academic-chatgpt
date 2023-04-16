<template>
  <a-list class="log-console" :data-source="logs">
    <!--suppress VueUnrecognizedSlot -->
    <template #renderItem="{ item }">
      <a-list-item>
        <p :class="{ [item.level]: item.level }">{{ item.message }}</p>
        <p class="w-32 text-end col-span-1 whitespace-nowrap">[{{ (item.timestamp as Date).toLocaleTimeString() }}]</p>
      </a-list-item>
    </template>

    <!--suppress VueUnrecognizedSlot -->
    <template #footer>
      <div class="h-2" ref="viewBottom"></div>
    </template>
  </a-list>
</template>

<script setup lang="ts">
const viewBottom = ref<Element | null>(null);

const props = defineProps<{ logs: LogMessage[] }>();
const { logs } = toRefs(props);
watch(logs, scrollToConsoleEnd, { deep: true });

/**
 * Scroll to the bottom of the console.
 */
function scrollToConsoleEnd() {
  viewBottom.value?.scrollIntoView({ behavior: 'smooth', block: 'end' });
}
</script>

<style lang="sass">
.log-console
  .ant-list-footer
    padding: 0

  .ant-list-items
    padding: 8px
    background: #fafafa
    border-radius: 4px

  li
    &.ant-list-item
      padding: 0
      border: 0 !important

    &.ant-list-item:hover
      background: #e6f7ff

    p
      margin: 0

p.warn
  color: #faad14

p.error
  color: #f5222d
</style>
