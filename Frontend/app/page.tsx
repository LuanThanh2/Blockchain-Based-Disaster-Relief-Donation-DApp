import { redirect } from "next/navigation";

export default function Page() {
  // Redirect root to the admin dashboard
  redirect("/reliefadmin/dashboard");
  return null;
}
