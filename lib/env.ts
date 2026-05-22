import { z } from "zod";

const serverEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(16),
  DASHBOARD_AUTH_TOKEN: z.string().min(16).optional(),
  ENCRYPTION_KEY: z.string().min(32),
  META_GRAPH_VERSION: z.string().default("v21.0"),
  META_INSTAGRAM_BUSINESS_ACCOUNT_ID: z.string().min(1),
  META_APP_ID: z.string().min(1).optional(),
  META_APP_SECRET: z.string().min(1).optional(),
  GOOGLE_BUSINESS_ACCOUNT_ID: z.string().min(1),
  GOOGLE_BUSINESS_LOCATION_ID: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  WEBHOOK_URL: z.string().url().optional(),
  SUPABASE_TEMP_BUCKET: z.string().default("media-temp"),
  SUPABASE_GALLERY_BUCKET: z.string().default("gallery-media"),
  SYNC_BATCH_LIMIT: z.coerce.number().int().min(1).max(100).default(25),
  MAX_RETRY_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(8)
});

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional()
});

export type ServerEnv = z.infer<typeof serverEnvSchema> & {
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
};
export type PublicEnv = z.infer<typeof publicEnvSchema> & {
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
};

export function getServerEnv(): ServerEnv {
  const env = serverEnvSchema.parse(process.env);
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return {
    ...env,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseKey
  };
}

export function getPublicEnv(): PublicEnv {
  const env = publicEnvSchema.parse(process.env);
  const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return {
    ...env,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseKey
  };
}
