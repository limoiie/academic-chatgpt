import { Ref } from 'vue';

export function useScrollOverflow(
  elem: HTMLElement,
  threashold: number = 0,
  autoScrollToEnd: Ref<boolean> = ref(false),
) {
  const reachEnd = ref(false);
  const leaveEnd = ref(false);

  elem.addEventListener('scroll', (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target as HTMLElement;
    leaveEnd.value = reachEnd.value && scrollTop + clientHeight + threashold < scrollHeight;
    reachEnd.value = scrollTop + clientHeight + threashold >= scrollHeight;
  });

  watch(reachEnd, (value) => {
    if (value) {
      autoScrollToEnd.value = true;
    }
  });
  watch(leaveEnd, (value) => {
    if (value) {
      autoScrollToEnd.value = false;
    }
  });

  return {
    reachEnd,
    leaveEnd,
    autoScrollToEnd,
  };
}
