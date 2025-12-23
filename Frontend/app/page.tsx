import { redirect } from "next/navigation";

export default function Page() {
  // Redirect root to the create-campaign admin page
  redirect("/reliefadmin/create-campaign");
  return null;
}
