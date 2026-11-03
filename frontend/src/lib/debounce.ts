export const searchInputDebounceMs = 300;

export type Debounced<Args extends unknown[]> = ((...args: Args) => void) & {
  cancel: () => void;
  flush: () => void;
};

export function debounce<Args extends unknown[]>(fn: (...args: Args) => void, wait: number): Debounced<Args> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: Args | undefined;

  const debounced = ((...args: Args) => {
    pending = args;
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      const argsToCall = pending;
      pending = undefined;
      if (argsToCall) fn(...argsToCall);
    }, wait);
  }) as Debounced<Args>;

  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  };

  debounced.flush = () => {
    if (timer === undefined || pending === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    const argsToCall = pending;
    pending = undefined;
    fn(...argsToCall);
  };

  return debounced;
}
