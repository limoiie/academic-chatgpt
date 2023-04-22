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
    console.log('scroll', scrollTop + clientHeight, scrollHeight);
    leaveEnd.value = reachEnd.value && scrollTop + clientHeight + threashold < scrollHeight;
    reachEnd.value = scrollTop + clientHeight + threashold >= scrollHeight;
  });

  elem.addEventListener('wheel', (e) => {
    if (e.deltaY < 0) {
      autoScrollToEnd.value = false;
    }
  })

  watch(reachEnd, (value) => {
    if (value) {
      autoScrollToEnd.value = true;
    }
  });

  return {
    reachEnd,
    leaveEnd,
    autoScrollToEnd,
  };
}
