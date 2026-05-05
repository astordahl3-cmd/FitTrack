import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import {
  Plus, Trash2, Dumbbell, Timer, Flame, ChevronDown, ChevronUp,
  Thermometer, Activity, Check, Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getRecentWorkouts, addWorkout, deleteWorkout } from "@/lib/storage";
import type { WorkoutSession } from "@/lib/storage";

// ── Types ────────────────────────────────────────────────────────────────────

interface LiftSet {
  weight: string; // lbs
  reps: string;
}

interface LiftExercise {
  kind: "lift";
  name: string;
  sets: LiftSet[];
}

interface CardioExercise {
  kind: "cardio";
  type: string;     // e.g. Treadmill, Bike, Elliptical
  duration: string; // minutes
  intensity: string; // e.g. Low / Moderate / High, or speed/incline
}

type Exercise = LiftExercise | CardioExercise;

interface DetailedWorkout {
  exercises: Exercise[];
  sauna: boolean;
  saunaDuration: string; // minutes
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CARDIO_TYPES = ["Treadmill", "Incline Walk", "Bike", "Elliptical", "Stairmaster", "Row", "Run", "Other"];
const INTENSITY_OPTIONS = ["Low", "Moderate", "High", "Max"];

function emptyLift(): LiftExercise {
  return { kind: "lift", name: "", sets: [{ weight: "", reps: "" }] };
}
function emptyCardio(): CardioExercise {
  return { kind: "cardio", type: "Treadmill", duration: "", intensity: "Moderate" };
}

// ── Lift Block ────────────────────────────────────────────────────────────────

function LiftBlock({
  ex, idx, onChange, onRemove,
}: {
  ex: LiftExercise; idx: number;
  onChange: (ex: LiftExercise) => void;
  onRemove: () => void;
}) {
  const updateSet = (si: number, field: keyof LiftSet, val: string) => {
    const sets = ex.sets.map((s, i) => i === si ? { ...s, [field]: val } : s);
    onChange({ ...ex, sets });
  };
  const addSet = () => onChange({ ...ex, sets: [...ex.sets, { weight: ex.sets[ex.sets.length - 1]?.weight ?? "", reps: "" }] });
  const removeSet = (si: number) => onChange({ ...ex, sets: ex.sets.filter((_, i) => i !== si) });

  return (
    <Card className="border-border">
      <CardContent className="p-3 space-y-2.5">
        {/* Exercise name + remove */}
        <div className="flex items-center gap-2">
          <Dumbbell className="h-3.5 w-3.5 text-primary shrink-0" />
          <Input
            className="flex-1 h-8 text-sm font-medium"
            placeholder="Exercise name (e.g. Bench Press)"
            value={ex.name}
            onChange={e => onChange({ ...ex, name: e.target.value })}
          />
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Sets */}
        <div className="space-y-1.5">
          <div className="grid grid-cols-12 gap-1.5 text-[10px] text-muted-foreground font-medium px-0.5">
            <span className="col-span-1 text-center">#</span>
            <span className="col-span-5">Weight (lbs)</span>
            <span className="col-span-5">Reps</span>
            <span className="col-span-1" />
          </div>
          {ex.sets.map((s, si) => (
            <div key={si} className="grid grid-cols-12 gap-1.5 items-center">
              <span className="col-span-1 text-center text-xs text-muted-foreground font-semibold">{si + 1}</span>
              <Input
                type="number" inputMode="decimal"
                className="col-span-5 h-8 text-sm text-center"
                placeholder="0"
                value={s.weight}
                onChange={e => updateSet(si, "weight", e.target.value)}
              />
              <Input
                type="number" inputMode="numeric"
                className="col-span-5 h-8 text-sm text-center"
                placeholder="0"
                value={s.reps}
                onChange={e => updateSet(si, "reps", e.target.value)}
              />
              <button
                className="col-span-1 text-muted-foreground hover:text-destructive transition-colors text-center"
                onClick={() => ex.sets.length > 1 && removeSet(si)}
              >
                <Trash2 className="h-3 w-3 mx-auto" />
              </button>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={addSet}>
          <Plus className="h-3 w-3 mr-1" /> Add Set
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Cardio Block ──────────────────────────────────────────────────────────────

function CardioBlock({
  ex, onChange, onRemove,
}: {
  ex: CardioExercise;
  onChange: (ex: CardioExercise) => void;
  onRemove: () => void;
}) {
  return (
    <Card className="border-border">
      <CardContent className="p-3 space-y-2.5">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-sky-500 shrink-0" />
          <span className="text-sm font-medium flex-1">Cardio</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Type */}
          <div className="col-span-2">
            <Label className="text-xs mb-1 block">Type</Label>
            <div className="flex flex-wrap gap-1.5">
              {CARDIO_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => onChange({ ...ex, type: t })}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    ex.type === t
                      ? "bg-sky-500 text-white border-sky-500"
                      : "border-border text-muted-foreground hover:border-sky-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <Label className="text-xs mb-1 block">Duration (min)</Label>
            <Input
              type="number" inputMode="numeric"
              className="h-8 text-sm"
              placeholder="20"
              value={ex.duration}
              onChange={e => onChange({ ...ex, duration: e.target.value })}
            />
          </div>

          {/* Intensity */}
          <div>
            <Label className="text-xs mb-1 block">Intensity</Label>
            <div className="flex gap-1">
              {INTENSITY_OPTIONS.map(lvl => (
                <button
                  key={lvl}
                  onClick={() => onChange({ ...ex, intensity: lvl })}
                  className={`flex-1 text-[10px] py-1.5 rounded border transition-all ${
                    ex.intensity === lvl
                      ? "bg-sky-500 text-white border-sky-500"
                      : "border-border text-muted-foreground hover:border-sky-400"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Free-form notes for speed/incline etc */}
          <div className="col-span-2">
            <Label className="text-xs mb-1 block">Notes (speed, incline, etc.)</Label>
            <Input
              className="h-8 text-sm"
              placeholder="e.g. 3.2 mph / 12% incline"
              value={(ex as any).notes ?? ""}
              onChange={e => onChange({ ...ex, ...(e.target.value ? { notes: e.target.value } : {}) } as any)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Sauna Block ───────────────────────────────────────────────────────────────

function SaunaBlock({
  sauna, saunaDuration, onChange,
}: {
  sauna: boolean; saunaDuration: string;
  onChange: (sauna: boolean, dur: string) => void;
}) {
  return (
    <Card className={`border transition-all ${sauna ? "border-orange-400 bg-orange-500/5" : "border-border"}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <Thermometer className={`h-4 w-4 shrink-0 ${sauna ? "text-orange-500" : "text-muted-foreground"}`} />
          <div className="flex-1">
            <p className={`text-sm font-medium ${sauna ? "text-orange-600 dark:text-orange-400" : "text-foreground"}`}>Sauna</p>
            {sauna && (
              <div className="flex items-center gap-2 mt-1.5">
                <Input
                  type="number" inputMode="numeric"
                  className="h-7 w-20 text-sm"
                  placeholder="20"
                  value={saunaDuration}
                  onChange={e => onChange(true, e.target.value)}
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
            )}
          </div>
          <button
            onClick={() => onChange(!sauna, saunaDuration)}
            className={`h-6 w-6 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
              sauna ? "bg-orange-500 border-orange-500" : "border-muted-foreground/40 hover:border-orange-400"
            }`}
          >
            {sauna && <Check className="h-3.5 w-3.5 text-white" />}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Session Detail View (history card expanded) ───────────────────────────────

function SessionDetailView({ session }: { session: WorkoutSession }) {
  const [expanded, setExpanded] = useState(false);
  const exData: Exercise[] = Array.isArray(session.exercises) ? session.exercises : [];
  const saunaData = (session as any).sauna;
  const lifts = exData.filter((e): e is LiftExercise => e.kind === "lift");
  const cardios = exData.filter((e): e is CardioExercise => e.kind === "cardio");

  return (
    <div>
      {/* Summary row */}
      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mb-2">
        {session.duration && <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{session.duration} min</span>}
        {session.calories_burned && <span className="flex items-center gap-1"><Flame className="h-3 w-3" />~{session.calories_burned} kcal</span>}
        {lifts.length > 0 && <span className="flex items-center gap-1"><Dumbbell className="h-3 w-3" />{lifts.length} exercise{lifts.length !== 1 ? "s" : ""}</span>}
        {cardios.length > 0 && <span className="flex items-center gap-1"><Activity className="h-3 w-3" />{cardios.map(c => c.type).join(", ")}</span>}
        {saunaData?.sauna && <span className="flex items-center gap-1"><Thermometer className="h-3 w-3 text-orange-500" /><span className="text-orange-500">Sauna {saunaData.duration}min</span></span>}
      </div>

      {exData.length > 0 && (
        <button
          className="text-xs text-primary flex items-center gap-0.5 mb-2"
          onClick={() => setExpanded(e => !e)}
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Hide details" : "Show details"}
        </button>
      )}

      {expanded && (
        <div className="space-y-2 mt-1">
          {lifts.map((ex, i) => (
            <div key={i} className="rounded-lg bg-muted/40 p-2.5">
              <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                <Dumbbell className="h-3 w-3 text-primary" />{ex.name}
              </p>
              <div className="space-y-0.5">
                {ex.sets.map((s, si) => (
                  <div key={si} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-5 text-center font-medium text-foreground">{si + 1}</span>
                    <span>{s.weight} lbs</span>
                    <span>×</span>
                    <span>{s.reps} reps</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {cardios.map((ex, i) => (
            <div key={i} className="rounded-lg bg-sky-500/5 border border-sky-200 dark:border-sky-800 p-2.5">
              <p className="text-xs font-semibold flex items-center gap-1.5 mb-0.5">
                <Activity className="h-3 w-3 text-sky-500" />{ex.type}
              </p>
              <p className="text-xs text-muted-foreground">
                {ex.duration}min · {ex.intensity} intensity
                {(ex as any).notes ? ` · ${(ex as any).notes}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
      {session.notes && <p className="text-xs text-muted-foreground italic mt-1.5">{session.notes}</p>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function WorkoutDetail() {
  const { toast } = useToast();
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [saving, setSaving] = useState(false);

  // Form state
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [duration, setDuration] = useState("");
  const [caloriesBurned, setCaloriesBurned] = useState("");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([emptyLift()]);
  const [sauna, setSauna] = useState(false);
  const [saunaDuration, setSaunaDuration] = useState("20");

  const load = useCallback(async () => {
    const data = await getRecentWorkouts(30);
    setWorkouts(data.filter(w => Array.isArray(w.exercises) && w.exercises.some((e: any) => e.kind)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateExercise = (i: number, ex: Exercise) =>
    setExercises(prev => prev.map((e, idx) => idx === i ? ex : e));
  const removeExercise = (i: number) =>
    setExercises(prev => prev.filter((_, idx) => idx !== i));
  const addLift = () => setExercises(prev => [...prev, emptyLift()]);
  const addCardio = () => setExercises(prev => [...prev, emptyCardio()]);

  // Auto-calculate duration from cardio blocks + sauna
  const autoMinutes = exercises
    .filter((e): e is CardioExercise => e.kind === "cardio")
    .reduce((sum, e) => sum + (parseInt(e.duration) || 0), 0)
    + (sauna ? parseInt(saunaDuration) || 0 : 0);

  const handleSave = async () => {
    const hasLifts = exercises.some(e => e.kind === "lift" && e.name.trim());
    const hasCardio = exercises.some(e => e.kind === "cardio" && e.duration);
    if (!hasLifts && !hasCardio && !sauna) {
      toast({ title: "Nothing to log", description: "Add at least one exercise, cardio, or sauna", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Build type label
      const parts: string[] = [];
      if (hasLifts) parts.push("Lifting");
      if (hasCardio) {
        const cardioTypes = [...new Set(exercises.filter((e): e is CardioExercise => e.kind === "cardio").map(e => e.type))];
        parts.push(...cardioTypes);
      }
      if (sauna) parts.push("Sauna");
      const type = parts.join(" + ") || "Workout";

      // Clean exercises (drop empty lifts)
      const cleanExercises = exercises.filter(e =>
        e.kind === "cardio" ? e.duration !== "" : e.name.trim() !== ""
      );

      await addWorkout({
        date,
        type,
        duration: duration ? parseInt(duration) : autoMinutes || null,
        calories_burned: caloriesBurned ? parseInt(caloriesBurned) : null,
        exercises: cleanExercises,
        notes: notes || null,
        ...(sauna ? { sauna: { sauna: true, duration: saunaDuration } } : {}),
      } as any);

      await load();
      toast({ title: "Workout saved ✓" });

      // Reset
      setExercises([emptyLift()]);
      setSauna(false);
      setSaunaDuration("20");
      setDuration("");
      setCaloriesBurned("");
      setNotes("");
    } catch (e: any) {
      toast({ title: "Failed to save", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWorkout(id);
      await load();
    } catch (e: any) {
      toast({ title: "Failed to delete", description: e?.message, variant: "destructive" });
    }
  };

  const grouped = workouts.reduce((acc, w) => {
    if (!acc[w.date]) acc[w.date] = [];
    acc[w.date].push(w);
    return acc;
  }, {} as Record<string, WorkoutSession[]>);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Detailed Workout Log</h1>
        <p className="text-sm text-muted-foreground">Track sets, reps, cardio, and more</p>
      </div>

      {/* ── Logger Card ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Log Session</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">

          {/* Date + meta */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs mb-1 block">Date</Label>
              <Input type="date" className="h-8 text-sm" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Total Duration (min)</Label>
              <Input
                type="number" inputMode="numeric" className="h-8 text-sm"
                placeholder={autoMinutes > 0 ? String(autoMinutes) : "auto"}
                value={duration}
                onChange={e => setDuration(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Calories Burned</Label>
              <Input
                type="number" inputMode="numeric" className="h-8 text-sm"
                placeholder="optional"
                value={caloriesBurned}
                onChange={e => setCaloriesBurned(e.target.value)}
              />
            </div>
          </div>

          {/* Exercises */}
          <div className="space-y-2">
            {exercises.map((ex, i) =>
              ex.kind === "lift"
                ? <LiftBlock key={i} ex={ex} idx={i} onChange={e => updateExercise(i, e)} onRemove={() => removeExercise(i)} />
                : <CardioBlock key={i} ex={ex} onChange={e => updateExercise(i, e)} onRemove={() => removeExercise(i)} />
            )}
          </div>

          {/* Add buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={addLift} className="text-xs">
              <Dumbbell className="h-3.5 w-3.5 mr-1.5" /> Add Lifting Exercise
            </Button>
            <Button variant="outline" size="sm" onClick={addCardio} className="text-xs">
              <Activity className="h-3.5 w-3.5 mr-1.5 text-sky-500" /> Add Cardio
            </Button>
          </div>

          {/* Sauna */}
          <SaunaBlock
            sauna={sauna}
            saunaDuration={saunaDuration}
            onChange={(s, d) => { setSauna(s); setSaunaDuration(d); }}
          />

          {/* Notes */}
          <div>
            <Label className="text-xs mb-1 block">Notes</Label>
            <Textarea
              className="text-sm resize-none"
              placeholder="How did it go? PRs, energy, anything notable..."
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save Workout"}
          </Button>
        </CardContent>
      </Card>

      {/* ── History ──────────────────────────────────────────────────────────── */}
      {Object.keys(grouped).length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Detailed Sessions</h2>
          {Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([d, sessions]) => (
              <div key={d}>
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  {d === format(new Date(), "yyyy-MM-dd") ? "Today" : format(parseISO(d), "EEE, MMM d")}
                </p>
                <div className="space-y-2">
                  {sessions.map(session => (
                    <Card key={session.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-sm font-semibold">{session.type}</span>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 -mt-0.5"
                            onClick={() => handleDelete(session.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <SessionDetailView session={session} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
