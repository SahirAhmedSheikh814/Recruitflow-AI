import { redirect } from "next/navigation";

// The admin app has no public site — the root opens directly to Sign In.
export default function RootPage() {
  redirect("/login");
}
