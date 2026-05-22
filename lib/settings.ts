import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/security";

export async function getSetting(key: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("system_settings")
    .select("value, encrypted")
    .eq("key", key)
    .maybeSingle();

  if (error) throw error;
  if (!data?.value) return null;

  return data.encrypted ? decryptSecret(data.value) : data.value;
}

export async function setSetting(key: string, value: string, options?: { encrypted?: boolean; description?: string }) {
  const supabase = createAdminClient();
  const encrypted = options?.encrypted ?? true;
  const { error } = await supabase.from("system_settings").upsert(
    {
      key,
      value: encrypted ? encryptSecret(value) : value,
      encrypted,
      description: options?.description ?? null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "key" }
  );

  if (error) throw error;
}
