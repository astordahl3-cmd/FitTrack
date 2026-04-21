import { Link, useLocation } from "wouter";
import { LayoutDashboard, Utensils, Dumbbell, Scale, X } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/food", label: "Food Log", icon: Utensils },
  { href: "/workout", label: "Workouts", icon: Dumbbell },
  { href: "/weight", label: "Weight", icon: Scale },
];

interface SidebarProps {
  onClose: () => void;
}

export default function Sidebar({ onClose }: SidebarProps) {
  const [location] = useLocation();

  return (
    <div className="h-full bg-sidebar flex flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <svg
            aria-label="FitTrack"
            viewBox="0 0 28 28"
            fill="none"
            className="w-7 h-7"
          >
            {/* Dumbbell icon mark */}
            <rect x="1" y="10" width="5" height="8" rx="1.5" fill="hsl(174 70% 42%)" />
            <rect x="22" y="10" width="5" height="8" rx="1.5" fill="hsl(174 70% 42%)" />
            <rect x="6" y="12.5" width="16" height="3" rx="1.5" fill="hsl(174 70% 42%)" />
            <rect x="3" y="8" width="3" height="12" rx="1" fill="hsl(174 88% 32%)" />
            <rect x="22" y="8" width="3" height="12" rx="1" fill="hsl(174 88% 32%)" />
          </svg>
          <span className="font-bold text-white text-base tracking-tight">
            FitTrack
          </span>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden text-sidebar-foreground hover:text-sidebar-accent-foreground transition-colors"
          data-testid="button-close-sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Goal banner */}
      <div className="mx-3 mt-4 rounded-lg bg-sidebar-accent px-3 py-2.5">
        <p className="text-xs text-sidebar-foreground font-medium">Goal</p>
        <p className="text-sm text-sidebar-accent-foreground font-semibold">
          255 → 235 lbs
        </p>
        <p className="text-xs text-sidebar-foreground mt-0.5">By July 1, 2026</p>
        <div className="mt-2 h-1.5 rounded-full bg-sidebar-border overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: "0%" }}
          />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location === href || (href !== "/" && location.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              data-testid={`nav-${label.toLowerCase().replace(" ", "-")}`}
            >
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Daily targets reminder */}
      <div className="mx-3 mb-4 rounded-lg bg-sidebar-accent px-3 py-3 text-xs text-sidebar-foreground space-y-1">
        <p className="font-semibold text-sidebar-accent-foreground">Daily Targets</p>
        <p>🔥 2,100–2,200 kcal</p>
        <p>🥩 200–220g protein</p>
        <p>🏋️ Treadmill + Lift + Sauna</p>
      </div>
    </div>
  );
}
