"use client";
import { Menu, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand, ThemeToggle, UserRow } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Active only on this exact path (the section root). */
  exact?: boolean;
}
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavList({ groups, scope }: { groups: NavGroup[]; scope?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      {scope}
      <nav aria-label="Main" className="mt-6 flex-1 space-y-6 overflow-y-auto">
        {groups.map((g, i) => (
          <div key={g.label ?? i}>
            {g.label && <p className="mb-1.5 px-2.5 text-xs text-muted-foreground">{g.label}</p>}
            <ul className="space-y-0.5">
              {g.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm",
                        active ? "bg-border text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}

/**
 * Open plane shell: a labelled sidebar on the page ground, no top bar. On a phone the sidebar
 * folds into a 48px bar with a menu button that opens the same navigation as a sheet.
 */
export function Shell({ groups, scope, children }: { groups: NavGroup[]; scope?: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r px-3 py-5 md:flex">
        <Brand href="/projects" className="px-2.5" />
        <NavList groups={groups} scope={scope} />
        <div className="space-y-1 pt-3">
          <UserRow />
          <div className="px-1">
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background px-3 md:hidden">
        <Dialog open={open} onOpenChange={setOpen}>
          <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setOpen(true)}>
            <Menu />
          </Button>
          <DialogContent side="left" title="Menu">
            <div className="flex h-[calc(100vh-7rem)] flex-col">
              <NavList groups={groups} scope={scope} />
              <div className="pt-3">
                <UserRow />
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Brand href="/projects" />
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      <div className="min-w-0 flex-1">
        <div className="px-4 pb-16 pt-6 sm:px-8 md:pt-9">{children}</div>
      </div>
    </div>
  );
}

/** Page title row: a noun at 24px, one grey sentence, and only real actions on the right. */
export function PageHeader({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start gap-x-4 gap-y-3">
      <div className="min-w-0 flex-1 basis-72">
        <h1 className="text-2xl font-semibold leading-8 tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
