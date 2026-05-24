export const human = {
  delay: (min = 800, max = 2400) =>
    new Promise(r => setTimeout(r, min + Math.random() * (max - min))),

  click: async (el: Element) => {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width * (0.3 + Math.random() * 0.4);
    const y = rect.top + rect.height * (0.3 + Math.random() * 0.4);
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: x, clientY: y }));
    await human.delay(80, 200);
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: x, clientY: y }));
    await human.delay(60, 140);
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: x, clientY: y }));
    (el as HTMLElement).click();
  },

  type: async (el: HTMLInputElement, text: string) => {
    el.focus();
    for (const char of text) {
      el.value += char;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      await human.delay(40, 140);
    }
  },

  scroll: async (amount = 300) => {
    window.scrollBy({ top: amount + Math.random() * 100, behavior: 'smooth' });
    await human.delay(400, 900);
  },

  read: () => human.delay(1200, 3500),

  randomPause: async () => {
    if (Math.random() < 0.15) {
      await human.delay(5000, 30000);
    }
  }
};

export const RATE_LIMITS = {
  actionsPerMinute: 8,
  pageLoadsPerHour: 20,
  syncIntervalMinutes: 45,
  restProbability: 0.15,
};
