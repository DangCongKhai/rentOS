import { redirect } from "next/navigation";

// Redirect owner profile to the shared profile page
export default function OwnerProfilePage() {
  // Simple redirect to the shared profile page
  // URL parameters are preserved by the router
  redirect("/profile");
}
