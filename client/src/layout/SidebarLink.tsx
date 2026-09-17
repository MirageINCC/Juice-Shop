import { NavLink } from "react-router-dom";
import { Icon } from "@/components/Icon";
import { cn } from "@/lib/utils";

interface SidebarLinkProps {
  to: string;
  icon: string;
  label: string;
}

export function SidebarLink({ to, icon, label }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/12 text-brand-light"
            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute top-1.5 bottom-1.5 -left-px w-0.5 rounded-full bg-primary" />
          )}
          <Icon name={icon} size={18} variant={isActive ? "bold" : "linear"} />
          {label}
        </>
      )}
    </NavLink>
  );
}
