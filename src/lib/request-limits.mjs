export function createRequestLimits({ now = Date.now, perMinute = 30, dailyModelCalls = 200 } = {}) {
  const clients = new Map();
  let modelDay = -1;
  let modelCalls = 0;
  return {
    accept(ip) {
      const minute = Math.floor(now() / 60_000);
      if (clients.size > 10_000) for (const [key, value] of clients) if (value.minute !== minute) clients.delete(key);
      const entry = clients.get(ip);
      if (!entry || entry.minute !== minute) {
        if (!entry && clients.size >= 10_000) return false;
        clients.set(ip, { minute, count: 1 });
        return true;
      }
      if (entry.count >= perMinute) return false;
      entry.count += 1;
      return true;
    },
    reserveModelCall() {
      const day = Math.floor(now() / 86_400_000);
      if (day !== modelDay) { modelDay = day; modelCalls = 0; }
      if (modelCalls >= dailyModelCalls) return false;
      modelCalls += 1;
      return true;
    }
  };
}
