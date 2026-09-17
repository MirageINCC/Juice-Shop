import { Button } from "@/components/ui/button";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/auth/AuthContext";
import { SidebarLink } from "./SidebarLink";

export function AppSidebar() {
  const { user, loading, logout } = useAuth();

  return (
    <aside className="z-10 flex w-60 shrink-0 flex-col gap-1 border-r border-border bg-[rgba(8,9,11,0.88)] px-3 py-4 backdrop-blur-lg">
      <div className="flex items-center gap-2.5 px-2 pb-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-brand-light">
          <Icon name="shop" size={18} variant="bold" />
        </span>
        <span className="text-sm font-semibold tracking-wide">JUICE SHOP</span>
      </div>

      <div className="mx-2 mb-3 h-px bg-border" />

      <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        Lager
      </p>
      <nav className="flex flex-col gap-0.5">
        <SidebarLink to="/juices" icon="milk" label="Juices" />
        <SidebarLink to="/fruechte-gemuese" icon="apple" label="Früchte & Gemüse" />
        <SidebarLink to="/samen" icon="bag-2" label="Samen" />
      </nav>

      <div className="mt-auto" />

      <div className="rounded-lg border border-border bg-white/[0.02] p-2.5">
        {loading ? (
          <p className="px-1 text-xs text-muted-foreground">Lädt …</p>
        ) : user ? (
          <div className="flex items-center gap-2.5">
            <Icon name="profile-circle" size={22} className="text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.username}</p>
              {user.isAdmin && (
                <span className="text-[10px] font-semibold tracking-wider text-brand-light uppercase">
                  Admin
                </span>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={() => void logout()} aria-label="Abmelden">
              <Icon name="logout-01" size={16} />
            </Button>
          </div>
        ) : (
          <Button asChild className="w-full">
            <a href="/auth/discord/login">
              <Icon name="login-01" size={16} />
              Mit Discord anmelden
            </a>
          </Button>
        )}
      </div>
    </aside>
  );
}
