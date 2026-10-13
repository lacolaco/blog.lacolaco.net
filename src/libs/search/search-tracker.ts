// 表示の待ち (200ms) より十分長く、遅い打鍵の間隔を越えて「打ち終えた」とみなすため 1500ms にしている
export const SEARCH_IDLE_MS = 1500;

/**
 * 検索語を打ち終えた時点で 1 回だけ送る。
 * 打ち終えは「入力が SEARCH_IDLE_MS 止まった」「結果を選んだ」「閉じた」のいずれかで判定する。
 */
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
    /** 入力のたびに呼ぶ。結果が出るまでの前の語は送らない */
    input() {
      pending = '';
      stopTimer();
    },
    /** 検索が成功して結果を表示したときに呼ぶ */
    resultShown(term: string) {
      pending = term.trim();
      stopTimer();
      timer = setTimeout(flush, SEARCH_IDLE_MS);
    },
    flush,
    /** 表示中の結果の語を、待たずに送る (結果を選んだとき) */
    commit(term: string) {
      pending = term.trim();
      flush();
    },
    /** ダイアログを開くとき、入力が空になったとき。同じ語をまた数えられるようにする */
    reset() {
      pending = '';
      last = '';
      stopTimer();
    },
  };
}
