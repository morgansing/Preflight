import { NavRail } from "@/components/nav-rail";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <NavRail />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
