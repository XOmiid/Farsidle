import { getSupabase } from '@/lib/classic/gateway';
export async function call(name, args = {}) {
  const client = await getSupabase();
  if (!client) throw new Error('کهکشانی به اتصال حساب نیاز دارد.');
  const { data, error } = await client.rpc('galactic_' + name, args);
  if (error)
    throw new Error(
      error.message.includes('Could not find')
        ? 'بخش کهکشانی هنوز روی سرور آماده نشده است.'
        : error.message,
    );
  return data;
}
export async function watch(id, refresh) {
  const client = await getSupabase();
  if (!client) return () => {};
  await client.realtime.setAuth();
  const channel = client
    .channel('galactic:' + id, { config: { private: true } })
    .on('broadcast', { event: 'changed' }, refresh)
    .subscribe();
  return () => {
    client.removeChannel(channel);
  };
}
