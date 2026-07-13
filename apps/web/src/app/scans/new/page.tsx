import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";
import { NewScanForm } from "@/components/NewScanForm";

export default async function NewScanPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <main className="shell">
      <AppNav email={user.email} />
      <NewScanForm />
    </main>
  );
}
