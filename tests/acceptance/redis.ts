const values = new Map<string, string>();
export default {
  get: async (key: string) => values.get(key) ?? null,
  set: async (key: string, value: string) => { values.set(key, value); return 'OK'; },
  setex: async (key: string, _ttl: number, value: string) => { values.set(key, value); return 'OK'; },
  getdel: async (key: string) => { const value = values.get(key); values.delete(key); return value ?? null; },
  del: async (key: string) => Number(values.delete(key)),
  expire: async () => 1,
};
