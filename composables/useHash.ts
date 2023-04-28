export function useHash() {
  const { $tauriCommands } = useNuxtApp();

  function hashStrInMd5(content: string) {
    return $tauriCommands.hashStrInMd5(content)
  }

  return {
    hashStrInMd5,
  };
}
