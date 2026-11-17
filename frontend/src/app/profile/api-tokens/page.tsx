import { redirect } from "next/navigation";

export default function ProfileApiTokensRedirect() {
  redirect("/api-tokens");
}
