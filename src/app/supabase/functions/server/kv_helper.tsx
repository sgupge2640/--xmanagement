// KVストアヘルパー関数
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const KV_TABLE = 'kv_store_aba46d8b';

export async function kvGet(key: string): Promise<any> {
  const { data, error } = await supabase
    .from(KV_TABLE)
    .select('value')
    .eq('key', key)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  
  return data?.value;
}

export async function kvSet(key: string, value: any): Promise<void> {
  const { error } = await supabase
    .from(KV_TABLE)
    .upsert({ key, value }, { onConflict: 'key' });
  
  if (error) throw error;
}

export async function kvDelete(key: string): Promise<void> {
  const { error } = await supabase
    .from(KV_TABLE)
    .delete()
    .eq('key', key);
  
  if (error) throw error;
}

export async function kvGetByPrefix(prefix: string): Promise<Array<{ key: string; value: any }>> {
  const { data, error } = await supabase
    .from(KV_TABLE)
    .select('key, value')
    .like('key', `${prefix}%`)
    .order('key');
  
  if (error) throw error;
  
  return data || [];
}

export async function kvDeleteByPrefix(prefix: string): Promise<void> {
  const { error } = await supabase
    .from(KV_TABLE)
    .delete()
    .like('key', `${prefix}%`);
  
  if (error) throw error;
}

// 自動インクリメントIDを生成
export async function kvGenerateId(counterKey: string): Promise<number> {
  const current = await kvGet(counterKey) || 0;
  const newId = current + 1;
  await kvSet(counterKey, newId);
  return newId;
}
