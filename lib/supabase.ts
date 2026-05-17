import { createBrowserClient } from "@supabase/ssr";

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

export const supabase = new Proxy(
  {} as ReturnType<typeof createBrowserClient>,
  {
    get: (target, prop) => {
      if (!supabaseClient) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!url || !key) {
          throw new Error(
            "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.",
          );
        }

        supabaseClient = createBrowserClient(url, key);
      }

      return (supabaseClient as ReturnType<typeof createBrowserClient>)[
        prop as keyof ReturnType<typeof createBrowserClient>
      ];
    },
  },
);
