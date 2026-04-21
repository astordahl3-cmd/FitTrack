import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { Plus, Trash2, Dumbbell, Clock, Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getRecentWorkouts, addWorkout, deleteWorkout } from "@/lib/storage";
import type { WorkoutSession } from "@/lib/storage";

const WORKOUT_TEMPLATES = [
  {
    type: "Upper Body A (Mon/Thu)",
    duration: 75,
    caloriesBurned: 420,
    exercises: ["Chest Press 4×10", "Cable Row 4×10", "Shoulder Press 3×12", "Lat Pulldown 3×12", "Tricep Pushdown 3×15", "Bicep Curl 3×12"],
  },
  {
    type: "Lower Body (Tue/Fri)",
    duration: 75,
    caloriesBurned: 450,
    exercises: ["Leg Press 4×12", "Romanian Deadlift 3×12", "Leg Extension 3×15", "Leg Curl 3×15", "Calf Raise 4×20", "Plank 3×45s"],
  },
  {
    type: "Incline Treadmill",
    duration: 20,
    caloriesBurned: 250,
    exercises: ["3.2 mph / 12% incline / 20 min"],
  },
  {
    type: "Sauna",
    duration: 20,
    caloriesBurned: 50,
    exercises: ["20 min sauna session"],
  },
  {
    type: "Full Session",
    duration: 60,
    caloriesBurned: 470,
    exercises: ["Treadmill 3.2mph/12% 20min", "Lifting 20min", "Sauna 20min"],
  },
  {
    type: "Custom",
    duration: 30,
    caloriesBurned: 200,
    exercises: [],
  },
];

export default function WorkoutLog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState(WORKOUT_TEMPLATES[4]);
  const [customExercise, setCustomExercise] = useState("");
  const [exercises, setExercises] = useState<string[]>(WORKOUT_TEMPLATES[4].exercises);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    type: WORKOUT_TEMPLATES[4].type,
    duration: String(WORKOUT_TEMPLATES[4].duration),
    caloriesBurned: String(WORKOUT_TEMPLATES[4].caloriesBurned),
    notes: "",
  });

  const load = useCallback(async () => {
    const data = await getRecentWorkouts(30);
    setWorkouts(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const applyTemplate = (template: typeof WORKOUT_TEMPLATES[0]) => {
    setSelectedTemplate(template);
    setExercises(template.exercises);
    setForm(f => ({
      ...f,
      type: template.type,
      duration: String(template.duration),
      caloriesBurned: String(template.caloriesBurned),
    }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await addWorkout({
        date: form.date,
        type: form.type,
        duration: parseInt(form.duration),
        calories_burned: form.caloriesBurned ? parseInt(form.caloriesBurned) : null,
        exercises: exercises,
        notes: form.notes || null,
      });
      await load();
      setOpen(false);
      toast({ title: "Workout logged ✓" });
    } catch (e: any) {
      toast({ title: "Failed to save workout", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWorkout(id);
      await load();
    } catch (e: any) {
      toast({ title: "Failed to delete", description: e?.message ?? "Unknown error", variant: "destructive" });
    }
  };

  const grouped = workouts.reduce((acc, w) => {
    if (!acc[w.date]) acc[w.date] = [];
    acc[w.date].push(w);
    return acc;
  }, {} as Record<string, WorkoutSession[]>);

  const totalCalsBurned = workouts
    .filter(w => w.date === format(new Date(), "yyyy-MM-dd"))
    .reduce((a, w) => a + (w.calories_burned ?? 0), 0);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Workouts</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> Log Workout</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Log Workout</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Quick Templates</Label>
                <div className="grid grid-cols-2 gap-2">
                  {WORKOUT_TEMPLATES.map(t => (
                    <button
                      key={t.type}
                      onClick={() => applyTemplate(t)}
                      className={`text-left px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                        selectedTemplate.type === t.type
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <p className="font-semibold">{t.type}</p>
                      <p className="text-muted-foreground">{t.duration}min · ~{t.caloriesBurned}kcal</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <Label>Duration (min)</Label>
                  <Input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} />
                </div>
                <div>
                  <Label>Type</Label>
                  <Input value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} />
                </div>
                <div>
                  <Label>Calories Burned</Label>
                  <Input type="number" value={form.caloriesBurned} onChange={e => setForm(f => ({ ...f, caloriesBurned: e.target.value }))} />
                </div>
              </div>

              <div>
                <Label className="mb-2 block">Exercises</Label>
                <div className="space-y-1.5 mb-2">
                  {exercises.map((ex, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-muted rounded px-2 py-1">
                      <span className="flex-1">{ex}</span>
                      <button onClick={() => setExercises(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">×</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add exercise..."
                    value={customExercise}
                    onChange={e => setCustomExercise(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && customExercise) {
                        setExercises(prev => [...prev, customExercise]);
                        setCustomExercise("");
                      }
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={() => { if (customExercise) { setExercises(prev => [...prev, customExercise]); setCustomExercise(""); } }}>Add</Button>
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="How did it go?" rows={2} />
              </div>

              <Button onClick={handleSubmit} disabled={saving} className="w-full">
                {saving ? "Saving..." : "Log Workout"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {totalCalsBurned > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Flame className="h-4 w-4 text-primary" /></div>
            <div>
              <p className="text-sm font-bold stat-value">{totalCalsBurned} kcal burned today</p>
              <p className="text-xs text-muted-foreground">Keep it up — stay on target</p>
            </div>
          </CardContent>
        </Card>
      )}

      {Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Dumbbell className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No workouts logged yet</p>
            <p className="text-xs mt-1">Log your first session above</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, sessions]) => (
            <div key={date}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {date === format(new Date(), "yyyy-MM-dd") ? "Today" : format(parseISO(date), "EEE, MMM d")}
              </p>
              <div className="space-y-2">
                {sessions.map(session => {
                  const exList: string[] = Array.isArray(session.exercises) ? session.exercises : [];
                  return (
                    <Card key={session.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold">{session.type}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{session.duration} min</span>
                              {session.calories_burned != null && (
                                <span className="flex items-center gap-1"><Flame className="h-3 w-3" />~{session.calories_burned} kcal</span>
                              )}
                            </div>
                            {exList.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {exList.slice(0, 4).map((ex, i) => (
                                  <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full">{ex}</span>
                                ))}
                                {exList.length > 4 && (
                                  <span className="text-xs text-muted-foreground">+{exList.length - 4} more</span>
                                )}
                              </div>
                            )}
                            {session.notes && <p className="text-xs text-muted-foreground mt-1.5 italic">{session.notes}</p>}
                          </div>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => handleDelete(session.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
      )}
    </div>
  );
}
