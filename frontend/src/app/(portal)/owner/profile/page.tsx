import { redirect } from "next/navigation";

export default async function OwnerProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string | string[] }>;
}) {
  const params = await searchParams;
  const verified = Array.isArray(params.verified)
    ? params.verified[0]
    : params.verified;
  redirect(
    verified ? `/profile?verified=${encodeURIComponent(verified)}` : "/profile",
  );
}
