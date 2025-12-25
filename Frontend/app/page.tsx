import { redirect } from "next/navigation";

export default function Page() {
  // Redirect root to public campaigns page (Guest mode)
  redirect("/reliefs");
  return null;
}
