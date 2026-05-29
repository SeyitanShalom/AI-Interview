export const PROFILE_RESUME_COLUMNS = [
  "resume_url",
  "resume_text",
  "resume_summary",
] as const;

export const PROFILE_ROLE_COLUMNS = ["resume_roles", "target_roles"] as const;

export const PROFILE_EXTENDED_COLUMNS = [
  ...PROFILE_RESUME_COLUMNS,
  ...PROFILE_ROLE_COLUMNS,
] as const;

export const PROFILE_COMPAT_COLUMNS = [
  "id",
  "role",
  ...PROFILE_EXTENDED_COLUMNS,
] as const;

export const PROFILE_RESUME_MIGRATION_MESSAGE =
  "Profile resume columns are missing in Supabase. Run the latest migration to save resume uploads and summaries.";

export const PROFILE_ROLE_MIGRATION_MESSAGE =
  "Profile role columns are missing in Supabase. Run the latest migration to save role suggestions.";

export const PROFILE_CONTEXT_MIGRATION_MESSAGE =
  "Profile resume or role columns are missing in Supabase. Run the latest migration to save candidate context.";

export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    return [
      maybeError.message,
      maybeError.details,
      maybeError.hint,
      maybeError.code,
    ]
      .filter((part): part is string => typeof part === "string" && !!part)
      .join(" ");
  }

  return typeof error === "string" ? error : "";
};

export const isMissingProfileColumn = (
  error: unknown,
  columns: readonly string[],
) => {
  const message = getErrorMessage(error).toLowerCase();

  const isSchemaMiss =
    message.includes("schema cache") ||
    message.includes("could not find") ||
    message.includes("does not exist");

  return (
    isSchemaMiss && columns.some((column) => message.includes(column))
  );
};

export const getMissingProfileColumns = (
  error: unknown,
  columns: readonly string[],
) => {
  if (!isMissingProfileColumn(error, columns)) return [];

  const message = getErrorMessage(error).toLowerCase();
  return columns.filter((column) => message.includes(column));
};

export const isMissingProfileResumeColumn = (error: unknown) =>
  isMissingProfileColumn(error, PROFILE_RESUME_COLUMNS);

export const isMissingProfileRoleColumn = (error: unknown) =>
  isMissingProfileColumn(error, PROFILE_ROLE_COLUMNS);

export const isMissingExtendedProfileColumn = (error: unknown) =>
  isMissingProfileColumn(error, PROFILE_EXTENDED_COLUMNS);
