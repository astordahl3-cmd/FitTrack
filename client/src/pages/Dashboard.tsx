import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Scale, Utensils, Dumbbell, TrendingDown, Flame, Beef } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { getDailySummary, getWeightEntries } from "@/lib/storage";

const CALORIE_TARGET = 2200;
const PROTEIN_TARGET = 210;
const GOAL_START = 255;
const GOAL_END = 235;

function MacroRing({ value, max, color, label, unit = "g" }: {
  value: number; max: number; color: string; label: string; unit?: string;
}) {
  const r = 32;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const offset = circ * (1 - pct);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke={color} strokeWidth="7"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="progress-ring__circle"
        />
        <text x="40" y="38" textAnchor="middle" className="text-xs font-bold fill-foreground" fontSize="13" fontFamily="DM Sans, sans-serif" fontWeight="700">
          {Math.round(value)}
        </text>
        <text x="40" y="52" textAnchor="middle" className="fill-muted-foreground" fontSize="9" fontFamily="DM Sans, sans-serif">
          /{max}{unit}
        </text>
      </svg>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, href }: {
  icon: any; label: string; value: string; sub?: string; color: string; href?: string;
}) {
  const content = (
    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-xl font-bold mt-0.5 stat-value">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}><a className="block">{content}</a></Link> : content;
}

export default function Dashboard() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [summary, setSummary] = useState(() => getDailySummary(today));
  const [latestWeight, setLatestWeight] = useState<number | null>(null);

  useEffect(() => {
    setSummary(getDailySummary(today));
    const wh = getWeightEntries(7);
    setLatestWeight(wh[0]?.weight ?? null);
  }, [today]);

  // Refresh on focus (after logging from other pages)
  useEffect(() => {
    const refresh = () => {
      setSummary(getDailySummary(today));
      const wh = getWeightEntries(7);
      setLatestWeight(wh[0]?.weight ?? null);
    };
    window.addEventListener("focus", refresh);
    // Also refresh on storage changes from same tab
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("focus", refresh); window.removeEventListener("storage", refresh); };
  }, [today]);

  const pct = latestWeight
    ? Math.round(((GOAL_START - latestWeight) / (GOAL_START - GOAL_END)) * 100)
    : 0;

  const caloriesLeft = CALORIE_TARGET - (summary?.calories ?? 0);
  const proteinLeft = PROTEIN_TARGET - (summary?.protein ?? 0);

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">
          {format(new Date(), "EEEE, MMMM d")}
        </h1>
        <p className="text-sm text-muted-foreground">Here's your day so far</p>
      </div>

      {/* Goal progress */}
      <Card className="border-primary/20 bg-primary/5 dark:bg-primary/10">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Goal Progress</span>
            </div>
            <span className="text-sm font-bold text-primary">{pct}% there</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden mb-2">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700"
              style={{ width: `${Math.max(pct, 0)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>255 lbs (start)</span>
            <span className="font-medium text-foreground">
              {latestWeight ? `Current: ${latestWeight} lbs` : "Log your weight to track progress"}
            </span>
            <span>235 lbs · Jul 1</span>
          </div>
        </CardContent>
      </Card>

      {/* Macro rings */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Today's Nutrition</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex justify-around py-2">
            <MacroRing value={summary?.calories ?? 0} max={CALORIE_TARGET} color="hsl(220 70% 55%)" label="Calories" unit="kcal" />
            <MacroRing value={summary?.protein ?? 0} max={PROTEIN_TARGET} color="hsl(174 88% 25%)" label="Protein" />
            <MacroRing value={summary?.carbs ?? 0} max={130} color="hsl(38 92% 50%)" label="Carbs" />
            <MacroRing value={summary?.fat ?? 0} max={90} color="hsl(0 72% 51%)" label="Fat" />
          </div>
          <div className="flex gap-3 mt-3">
            <div className={`flex-1 rounded-lg px-3 py-2 text-center ${caloriesLeft >= 0 ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
              <p className={`text-sm font-bold stat-value ${caloriesLeft >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-red-600'}`}>
                {caloriesLeft >= 0 ? caloriesLeft : Math.abs(caloriesLeft)} kcal
              </p>
              <p className="text-xs text-muted-foreground">{caloriesLeft >= 0 ? "remaining" : "over target"}</p>
            </div>
            <div className={`flex-1 rounded-lg px-3 py-2 text-center ${proteinLeft >= 0 ? 'bg-teal-50 dark:bg-teal-950/30' : 'bg-green-50 dark:bg-green-950/30'}`}>
              <p className={`text-sm font-bold stat-value ${proteinLeft >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-green-600'}`}>
                {proteinLeft >= 0 ? proteinLeft.toFixed(0) : "✓ " + Math.abs(proteinLeft).toFixed(0) + "g over"} {proteinLeft >= 0 ? "g left" : ""}
              </p>
              <p className="text-xs text-muted-foreground">protein {proteinLeft >= 0 ? "to go" : "goal hit!"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Scale}
          label="Today's Weight"
          value={latestWeight ? `${latestWeight} lbs` : "—"}
          sub={latestWeight ? `${(latestWeight - GOAL_END).toFixed(1)} lbs to go` : "Tap to log"}
          color="bg-primary/10 text-primary"
          href="/weight"
        />
        <StatCard
          icon={Flame}
          label="Meals Logged"
          value={`${summary?.foodEntries?.length ?? 0}`}
          sub={`${summary?.calories ?? 0} kcal total`}
          color="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
          href="/food"
        />
        <StatCard
          icon={Dumbbell}
          label="Workouts"
          value={`${summary?.workouts?.length ?? 0}`}
          sub={summary?.workouts?.length ? summary.workouts.map((w: any) => w.type).join(", ") : "None logged"}
          color="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
          href="/workout"
        />
        <StatCard
          icon={Beef}
          label="Protein Today"
          value={`${Math.round(summary?.protein ?? 0)}g`}
          sub={`Target: ${PROTEIN_TARGET}g`}
          color="bg-primary/10 text-primary"
          href="/food"
        />
      </div>

      {/* Today's meals */}
      {summary?.foodEntries?.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Today's Meals</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {summary.foodEntries.map((entry: any) => (
              <div key={entry.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium">{entry.name}</p>
                  <p className="text-xs text-muted-foreground">{entry.meal} · {entry.protein}g protein</p>
                </div>
                <span className="text-sm font-semibold stat-value text-foreground">{entry.calories} kcal</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Today's workouts */}
      {summary?.workouts?.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Today's Workouts</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {summary.workouts.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between py-1.5">
                <div>
                  <p className="text-sm font-medium">{w.type}</p>
                  <p className="text-xs text-muted-foreground">{w.duration} min{w.caloriesBurned ? ` · ~${w.caloriesBurned} kcal` : ""}</p>
                </div>
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Done</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Quick add links */}
      <div className="grid grid-cols-3 gap-3 pb-4">
        {[
          { href: "/food", icon: Utensils, label: "Log Food" },
          { href: "/workout", icon: Dumbbell, label: "Log Workout" },
          { href: "/weight", icon: Scale, label: "Log Weight" },
        ].map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}>
            <a>
              <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1.5">
                <Icon className="h-4 w-4" />
                <span className="text-xs">{label}</span>
              </Button>
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
}
