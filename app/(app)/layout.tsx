import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="app-bg flex h-screen overflow-hidden">
      <Sidebar email={user.email ?? ""} />
      <div className="app-bg-main flex min-w-0 flex-1 flex-col overflow-hidden pt-14 md:pt-0">
        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
