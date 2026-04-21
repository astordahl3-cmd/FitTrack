import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Utensils, Dumbbell, Scale, X, LogOut, UserCog } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { getProfile } from "@/lib/storage";
import type { UserProfile } from "@/lib/storage";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/food", label: "Food Log", icon: Utensils },
  { href: "/workout", label: "Workouts", icon: Dumbbell },
  { href: "/weight", label: "Weight", icon: Scale },
  { href: "/profile", label: "Profile", icon: UserCog },
];

interface SidebarProps {
  onClose: () => void;
  onSignOut?: () => void;
  user?: User | null;
}

export default function Sidebar({ onClose, onSignOut, user }: SidebarProps) {
  const [location] = useLocation();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => {});
  }, []);

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
      {(profile?.start_weight || profile?.goal_weight) && (
        <div className="mx-3 mt-4 rounded-lg bg-sidebar-accent px-3 py-2.5">
          <p className="text-xs text-sidebar-foreground font-medium">Goal</p>
          <p className="text-sm text-sidebar-accent-foreground font-semibold">
            {profile.start_weight ?? "?"} → {profile.goal_weight ?? "?"} lbs
          </p>
          {profile.goal_date && (
            <p className="text-xs text-sidebar-foreground mt-0.5">
              By {new Date(profile.goal_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
        </div>
      )}

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

      {/* Daily targets */}
      <div className="mx-3 rounded-lg bg-sidebar-accent px-3 py-3 text-xs text-sidebar-foreground space-y-1">
        <p className="font-semibold text-sidebar-accent-foreground">Daily Targets</p>
        <p>🔥 {(profile?.calorie_target ?? 2200).toLocaleString()} kcal</p>
        <p>🥩 {profile?.protein_target ?? 210}g protein</p>
        {profile?.carb_target != null && <p>🌾 {profile.carb_target}g carbs</p>}
        {profile?.fat_target != null && <p>🧈 {profile.fat_target}g fat</p>}
      </div>

      {/* User + sign out */}
      {user && (
        <div className="mx-3 mb-4 mt-3 flex items-center justify-between">
          <p className="text-xs text-sidebar-foreground truncate">{user.email}</p>
          <button onClick={onSignOut} className="text-sidebar-foreground hover:text-white transition-colors ml-2 shrink-0" title="Sign out">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
