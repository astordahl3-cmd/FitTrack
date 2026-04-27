import { useState, useEffect, useCallback } from "react";
import { format, subDays, parseISO } from "date-fns";
import {
  Flame, Beef, Droplets, Dumbbell, Scale, TrendingDown, TrendingUp, Minus, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDailySummary, getWeightEntries, getProfile } from "@/lib/storage";
import type { UserProfile } from "@/lib/storage";

// ── helpers ─────────────────────────────────────────────────────────────────

function avg(vals: number[]) {
  const v = vals.filter(x => x > 0);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}
function sum(vals: number[]) {
  return vals.reduce((a, b) => a + b, 0);
}
function fmt1(n: number) {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

// ── mini bar chart ────────────────────────────────────────────────────────────

function MiniBar({
  values, target, color, days,
}: {
  values: (number | null)[];
  target: number;
  color: string;
  days: string[];
}) {
  const max = Math.max(target * 1.1, ...values.map(v => v ?? 0), 1);
  return (
    <div className="flex items-end gap-1 h-14">
      {values.map((v, i) => {
        const h = v ? Math.round((v / max) * 100) : 0;
        const over = v != null && v > target;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full flex flex-col justify-end" style={{ height: "48px" }}>
              <div
                className="w-full rounded-sm transition-all"
                style={{
                  height: `${h}%`,
                  backgroundColor: over ? "hsl(0 72% 51%)" : color,
                  minHeight: v ? "3px" : "0px",
                  opacity: v ? 1 : 0.15,
                }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground leading-none">{days[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── stat tile ─────────────────────────────────────────────────────────────────

function Tile({
  label, value, sub, color, icon: Icon,
}: {
  label: string; value: string; sub?: string; color: string; icon: any;
}) {
  return (
    <Card>
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between mb-1">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <div className={`p-1.5 rounded-md ${color}`}><Icon className="h-3.5 w-3.5" /></div>
        </div>
        <p className="text-lg font-bold leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── day row ───────────────────────────────────────────────────────────────────

function DayRow({
  label, calories, protein, water, workouts, calorieTarget, proteinTarget, isToday,
}: {
  label: string; calories: number; protein: number; water: number;
  workouts: number; calorieTarget: number; proteinTarget: number; isToday?: boolean;
}) {
  const calOk = calories > 0 && calories <= calorieTarget;
  const calOver = calories > calorieTarget;
  const protOk = protein >= proteinTarget;

  return (
    <div className={`flex items-center gap-2 py-2.5 border-b border-border last:border-0 ${isToday ? "font-semibold" : ""}`}>
      <span className="w-8 text-xs text-muted-foreground shrink-0">{label}</span>

      {/* calories */}
      <div className="flex-1 min-w-0">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min((calories / calorieTarget) * 100, 100)}%`,
              backgroundColor: calOver ? "hsl(0 72% 51%)" : "hsl(220 70% 55%)",
            }}
          />
        </div>
      </div>

      <span className={`text-xs w-14 text-right tabular-nums ${calOver ? "text-red-500" : calOk ? "text-foreground" : "text-muted-foreground"}`}>
        {calories > 0 ? `${calories} kcal` : "—"}
      </span>
      <span className={`text-xs w-10 text-right tabular-nums ${protOk ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground"}`}>
        {protein > 0 ? `${Math.round(protein)}g` : "—"}
      </span>
      <span className="text-xs w-6 text-right text-sky-500">{water > 0 ? water : "—"}</span>
      <span className="text-xs w-4 text-right text-purple-500">{workouts > 0 ? workouts : "—"}</span>
    </div>
  );
}

// ── weight delta badge ────────────────────────────────────────────────────────

function WeightDelta({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="text-muted-foreground text-xs">—</span>;
  if (Math.abs(delta) < 0.05) return (
    <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" /> 0 lbs</span>
  );
  return delta < 0
    ? <span className="flex items-center gap-0.5 text-xs text-green-600"><TrendingDown className="h-3 w-3" /> {Math.abs(delta).toFixed(1)} lbs</span>
    : <span className="flex items-center gap-0.5 text-xs text-red-500"><TrendingUp className="h-3 w-3" /> +{delta.toFixed(1)} lbs</span>;
}

// ── main page ─────────────────────────────────────────────────────────────────

interface DayData {
  date: string;
  label: string;
  shortLabel: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  water: number;
  workouts: number;
  weight: number | null;
  logged: boolean;
}

export default function WeeklySummary() {
  // weekOffset: 0 = current week, -1 = last week, etc.
  const [weekOffset, setWeekOffset] = useState(0);
  const [days, setDays] = useState<DayData[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [weightHistory, setWeightHistory] = useState<{ date: string; weight: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const startOfWeek = subDays(new Date(), 6 - weekOffset * 7 * -1 + 6); // Mon to today window

  // Build 7-day window ending on today (offset 0) or shifted back
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const windowDates = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), (6 - i) + Math.abs(weekOffset) * 7);
    return format(d, "yyyy-MM-dd");
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prof, weightEntries] = await Promise.all([
        getProfile(),
        getWeightEntries(90),
      ]);
      setProfile(prof);
      setWeightHistory(weightEntries.map(w => ({ date: w.date, weight: w.weight })));

      // fetch all 7 days in parallel
      const summaries = await Promise.all(windowDates.map(d => getDailySummary(d).catch(() => null)));

      const weightMap: Record<string, number> = {};
      weightEntries.forEach(w => { weightMap[w.date] = w.weight; });

      const result: DayData[] = windowDates.map((date, i) => {
        const s = summaries[i];
        const d = subDays(new Date(), (6 - i) + Math.abs(weekOffset) * 7);
        return {
          date,
          label: format(d, "EEE, MMM d"),
          shortLabel: format(d, "EEE"),
          calories: s?.calories ?? 0,
          protein: s?.protein ?? 0,
          carbs: s?.carbs ?? 0,
          fat: s?.fat ?? 0,
          fiber: s?.fiber ?? 0,
          water: s?.water ?? 0,
          workouts: s?.workouts?.length ?? 0,
          weight: weightMap[date] ?? null,
          logged: (s?.calories ?? 0) > 0,
        };
      });
      setDays(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [weekOffset]);

  useEffect(() => { load(); }, [load]);

  const CALORIE_TARGET = profile?.calorie_target ?? 2200;
  const PROTEIN_TARGET = profile?.protein_target ?? 210;
  const WATER_GOAL = profile?.water_goal ?? 8;

  const loggedDays = days.filter(d => d.logged);
  const avgCalories = Math.round(avg(days.map(d => d.calories)));
  const avgProtein = Math.round(avg(days.map(d => d.protein)));
  const totalWorkouts = sum(days.map(d => d.workouts));
  const avgWater = +avg(days.map(d => d.water)).toFixed(1);

  // Weight delta: last day with weight vs first day with weight this week
  const weightsThisWeek = days.filter(d => d.weight !== null).map(d => d.weight as number);
  const weightDelta = weightsThisWeek.length >= 2
    ? weightsThisWeek[weightsThisWeek.length - 1] - weightsThisWeek[0]
    : null;
  const latestWeight = weightsThisWeek.length ? weightsThisWeek[weightsThisWeek.length - 1] : null;

  // Days on target
  const daysOnCalorieTarget = loggedDays.filter(d => d.calories <= CALORIE_TARGET).length;
  const daysHitProtein = loggedDays.filter(d => d.protein >= PROTEIN_TARGET).length;

  // Week label
  const weekStart = format(subDays(new Date(), 6 + Math.abs(weekOffset) * 7), "MMM d");
  const weekEnd = format(subDays(new Date(), Math.abs(weekOffset) * 7), "MMM d");
  const isCurrentWeek = weekOffset === 0;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Weekly Summary</h1>
          <p className="text-sm text-muted-foreground">{weekStart} – {weekEnd}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(o => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(o => o + 1)} disabled={isCurrentWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground text-sm">Loading...</div>
      ) : (
        <>
          {/* Tiles */}
          <div className="grid grid-cols-2 gap-3">
            <Tile
              icon={Flame} label="Avg Calories" color="bg-blue-100 dark:bg-blue-900/30 text-blue-600"
              value={avgCalories > 0 ? `${avgCalories.toLocaleString()} kcal` : "—"}
              sub={loggedDays.length > 0 ? `${daysOnCalorieTarget}/${loggedDays.length} days on target` : "No days logged"}
            />
            <Tile
              icon={Beef} label="Avg Protein" color="bg-teal-100 dark:bg-teal-900/30 text-teal-600"
              value={avgProtein > 0 ? `${avgProtein}g` : "—"}
              sub={loggedDays.length > 0 ? `${daysHitProtein}/${loggedDays.length} days at goal` : "No days logged"}
            />
            <Tile
              icon={Scale} label="Latest Weight" color="bg-primary/10 text-primary"
              value={latestWeight ? `${latestWeight} lbs` : "—"}
              sub={weightDelta !== null ? (
                weightDelta < 0 ? `↓ ${Math.abs(weightDelta).toFixed(1)} lbs this week` :
                weightDelta > 0 ? `↑ ${weightDelta.toFixed(1)} lbs this week` : "No change this week"
              ) : "No weight logged"}
            />
            <Tile
              icon={Dumbbell} label="Workouts" color="bg-purple-100 dark:bg-purple-900/30 text-purple-600"
              value={`${totalWorkouts}`}
              sub={totalWorkouts === 1 ? "session this week" : "sessions this week"}
            />
          </div>

          {/* Calorie chart */}
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Calories</span>
                <span className="text-xs text-muted-foreground font-normal">Target: {CALORIE_TARGET.toLocaleString()} kcal</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <MiniBar
                values={days.map(d => d.logged ? d.calories : null)}
                target={CALORIE_TARGET}
                color="hsl(220 70% 55%)"
                days={days.map(d => d.shortLabel)}
              />
            </CardContent>
          </Card>

          {/* Protein chart */}
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Protein</span>
                <span className="text-xs text-muted-foreground font-normal">Target: {PROTEIN_TARGET}g</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <MiniBar
                values={days.map(d => d.logged ? d.protein : null)}
                target={PROTEIN_TARGET}
                color="hsl(174 88% 25%)"
                days={days.map(d => d.shortLabel)}
              />
            </CardContent>
          </Card>

          {/* Water + Workouts row */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-1 pt-3.5 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Droplets className="h-3.5 w-3.5 text-sky-500" /> Water
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3.5">
                <MiniBar
                  values={days.map(d => d.water || null)}
                  target={WATER_GOAL}
                  color="hsl(199 89% 48%)"
                  days={days.map(d => d.shortLabel)}
                />
                <p className="text-xs text-muted-foreground mt-2">Avg {fmt1(avgWater)} / {WATER_GOAL} glasses</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1 pt-3.5 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Dumbbell className="h-3.5 w-3.5 text-purple-500" /> Workouts
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3.5">
                <MiniBar
                  values={days.map(d => d.workouts || null)}
                  target={1}
                  color="hsl(270 70% 60%)"
                  days={days.map(d => d.shortLabel)}
                />
                <p className="text-xs text-muted-foreground mt-2">{totalWorkouts} session{totalWorkouts !== 1 ? "s" : ""} total</p>
              </CardContent>
            </Card>
          </div>

          {/* Day-by-day breakdown */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Day Breakdown</CardTitle>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                <span className="flex-1 text-right mr-2">kcal</span>
                <span className="w-10 text-right">prot</span>
                <span className="w-6 text-right">💧</span>
                <span className="w-4 text-right">🏋</span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {days.map(d => (
                <DayRow
                  key={d.date}
                  label={d.shortLabel}
                  calories={d.calories}
                  protein={d.protein}
                  water={d.water}
                  workouts={d.workouts}
                  calorieTarget={CALORIE_TARGET}
                  proteinTarget={PROTEIN_TARGET}
                  isToday={d.date === todayStr}
                />
              ))}
            </CardContent>
          </Card>

          {/* Macro totals */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Weekly Macro Totals</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                {[
                  { label: "Total Calories", value: `${sum(days.map(d => d.calories)).toLocaleString()} kcal` },
                  { label: "Total Protein",  value: `${Math.round(sum(days.map(d => d.protein)))}g` },
                  { label: "Total Carbs",    value: `${Math.round(sum(days.map(d => d.carbs)))}g` },
                  { label: "Total Fat",      value: `${Math.round(sum(days.map(d => d.fat)))}g` },
                  { label: "Total Fiber",    value: `${fmt1(Math.round(sum(days.map(d => d.fiber)) * 10) / 10)}g` },
                  { label: "Days Logged",    value: `${loggedDays.length} / 7` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between border-b border-border pb-2 last:border-0 last:pb-0 col-span-1">
                    <span className="text-muted-foreground text-xs">{label}</span>
                    <span className="font-semibold text-xs">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Weight delta callout */}
          {weightDelta !== null && (
            <Card className={`border-${weightDelta <= 0 ? "green" : "red"}-200 dark:border-${weightDelta <= 0 ? "green" : "red"}-900`}>
              <CardContent className="px-4 py-3 flex items-center gap-3">
                {weightDelta <= 0
                  ? <TrendingDown className="h-5 w-5 text-green-600 shrink-0" />
                  : <TrendingUp className="h-5 w-5 text-red-500 shrink-0" />}
                <div>
                  <p className="text-sm font-semibold">
                    {weightDelta < 0
                      ? `Down ${Math.abs(weightDelta).toFixed(1)} lbs this week`
                      : weightDelta > 0
                      ? `Up ${weightDelta.toFixed(1)} lbs this week`
                      : "Weight held steady this week"}
                  </p>
                  {latestWeight && (
                    <p className="text-xs text-muted-foreground">
                      Current: {latestWeight} lbs
                      {profile?.goal_weight ? ` · ${(latestWeight - profile.goal_weight).toFixed(1)} lbs to goal` : ""}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
