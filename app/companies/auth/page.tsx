import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CompaniesAuthRedirect({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const nextParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach((item) => nextParams.append(key, item));
    } else if (typeof value === "string") {
      nextParams.set(key, value);
    }
  }

  const query = nextParams.toString();
  redirect(`/company/auth${query ? `?${query}` : ""}`);
}
