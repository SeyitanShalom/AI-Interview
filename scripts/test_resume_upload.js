#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

(async () => {
  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment (or NEXT_PUBLIC_ variants).",
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const tmpDir = path.join(__dirname, "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, `test-resume-${Date.now()}.txt`);
  fs.writeFileSync(filePath, "This is a test resume upload file.");

  const remotePath = `test-uploads/${path.basename(filePath)}`;

  try {
    const fileBuffer = fs.readFileSync(filePath);
    console.log("Uploading", remotePath);
    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(remotePath, fileBuffer, {
        contentType: "text/plain",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("resumes")
      .getPublicUrl(remotePath);
    console.log("Uploaded. Public URL:", urlData.publicUrl);

    // Now delete
    console.log("Deleting", remotePath);
    const { error: deleteError } = await supabase.storage
      .from("resumes")
      .remove([remotePath]);
    if (deleteError) throw deleteError;
    console.log("Deleted successfully.");

    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err.message || err);
    process.exit(1);
  } finally {
    try {
      fs.unlinkSync(filePath);
    } catch {}
  }
})();
