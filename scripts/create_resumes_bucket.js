#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require("@supabase/supabase-js");

(async () => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.",
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data, error } = await supabase.storage.createBucket("resumes", {
      public: true,
    });
    if (error) {
      // Supabase may return an error if bucket exists
      if (error.message && /already exists/i.test(error.message)) {
        console.log('Bucket "resumes" already exists.');
        process.exit(0);
      }
      console.error("Failed to create bucket:", error.message || error);
      process.exit(1);
    }

    console.log('Created bucket "resumes":', data);
    process.exit(0);
  } catch (err) {
    console.error("Unexpected error creating bucket:", err);
    process.exit(1);
  }
})();
