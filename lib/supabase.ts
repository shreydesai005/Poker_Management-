import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL in .env.local"
  );
}

if (!supabaseKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local"
  );
}

export const supabase = createBrowserClient(
  supabaseUrl,
  supabaseKey
);