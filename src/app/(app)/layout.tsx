import { CommandPalette } from "@/components/command-palette";
import { MobileNav, NavRail } from "@/components/nav-rail";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Below lg the rail hides and MobileNav's top bar takes over; the
  // wrapper only becomes a flex row once the rail is actually visible.
  return (
    <div className="min-h-screen lg:flex">
      <NavRail />
      <MobileNav />
      <main className="min-w-0 lg:flex-1">{children}</main>
      <CommandPalette />
    </div>
  );
}
