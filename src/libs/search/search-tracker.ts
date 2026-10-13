export function createSearchTermTracker() {
  let last = '';

  return {
    shouldCount(term: string): boolean {
      const t = term.trim();
      if (!t) {
        last = '';
        return false;
      }
      if (t === last) return false;
      last = t;
      return true;
    },
    reset() {
      last = '';
    },
  };
}
