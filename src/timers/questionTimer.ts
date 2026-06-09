const timers = new Map<string, NodeJS.Timeout>();

export const questionTimer = {
  set(pin: string, delayMs: number, callback: () => Promise<void>) {
    this.clear(pin);
    const timer = setTimeout(async () => {
      timers.delete(pin);
      await callback();
    }, delayMs);
    timers.set(pin, timer);
  },

  clear(pin: string) {
    const timer = timers.get(pin);
    if (timer) {
      clearTimeout(timer);
      timers.delete(pin);
    }
  },
};
