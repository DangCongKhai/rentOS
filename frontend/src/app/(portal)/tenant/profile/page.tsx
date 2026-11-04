import { redirect } from "next/navigation";

// Redirect tenant profile to the shared profile page
export default function TenantProfilePage() {
  // Simple redirect to the shared profile page
  // URL parameters are preserved by the routerd
  redirect("/profile");
}
