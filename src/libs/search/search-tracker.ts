// 表示の待ち (200ms) より十分長く、遅い打鍵の間隔を越えて「打ち終えた」とみなすため 1500ms にしている
export const SEARCH_IDLE_MS = 1500;

export function createSearchReporter(send: (term: string) => void) {
  let pending = '';
  let last = '';
  let timer: ReturnType<typeof setTimeout> | undefined;

  const stopTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  const flush = () => {
    stopTimer();
    const term = pending;
    pending = '';
    if (!term || term === last) return;
    last = term;
    send(term);
  };

  return {
    input() {
      pending = '';
      stopTimer();
    },
    resultShown(term: string) {
      pending = term.trim();
      stopTimer();
      timer = setTimeout(flush, SEARCH_IDLE_MS);
    },
    flush,
    commit(term: string) {
      pending = term.trim();
      flush();
    },
    reset() {
      pending = '';
      last = '';
      stopTimer();
    },
  };
}
