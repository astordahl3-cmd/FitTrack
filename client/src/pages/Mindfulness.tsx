import { useState, useEffect, useCallback, useMemo } from "react";
import { format, parseISO, subDays } from "date-fns";
import { Plus, Trash2, Clock, Brain, BookOpen, Languages, HeartPulse, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getRecentMindfulness, addMindfulness, deleteMindfulness } from "@/lib/storage";
import type { MindfulnessSession, MindfulnessCategory } from "@/lib/storage";

const CATEGORIES: {
  key: MindfulnessCategory;
  label: string;
  icon: any;
  color: string;
  bg: string;
}[] = [
  { key: "language",      label: "Language Study", icon: Languages,   color: "text-sky-600",    bg: "bg-sky-100 dark:bg-sky-900/30" },
  { key: "bible",         label: "Bible Study",    icon: BookOpen,    color: "text-amber-600",  bg: "bg-amber-100 dark:bg-amber-900/30" },
  { key: "mental_health", label: "Mental Health",  icon: HeartPulse,  color: "text-rose-600",   bg: "bg-rose-100 dark:bg-rose-900/30" },
];

const DURATION_PRESETS = [5, 10, 15, 20, 30, 45, 60];

function categoryMeta(key: MindfulnessCategory) {
  return CATEGORIES.find(c => c.key === key) ?? CATEGORIES[0];
}

export default function Mindfulness() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<MindfulnessSession[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    category: "language" as MindfulnessCategory,
    duration: "15",
    notes: "",
  });

  const load = useCallback(async () => {
    const data = await getRecentMindfulness(60);
    setSessions(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    const duration = parseInt(form.duration);
    if (!duration || duration <= 0) {
      toast({ title: "Enter a duration in minutes", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await addMindfulness({
        date: form.date,
        category: form.category,
        duration,
        notes: form.notes || null,
      });
      await load();
      setOpen(false);
      setForm(f => ({ ...f, duration: "15", notes: "" }));
      toast({ title: "Mindfulness logged ✓" });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMindfulness(id);
      await load();
    } catch (e: any) {
      toast({ title: "Failed to delete", description: e?.message ?? "Unknown error", variant: "destructive" });
    }
  };

  const today = format(new Date(), "yyyy-MM-dd");
  const last7Start = format(subDays(new Date(), 6), "yyyy-MM-dd");

  const todayByCategory = useMemo(() => {
    const map: Record<MindfulnessCategory, number> = { language: 0, bible: 0, mental_health: 0 };
    for (const s of sessions) {
      if (s.date === today) map[s.category] += s.duration;
    }
    return map;
  }, [sessions, today]);

  const weekByCategory = useMemo(() => {
    const map: Record<MindfulnessCategory, number> = { language: 0, bible: 0, mental_health: 0 };
    for (const s of sessions) {
      if (s.date >= last7Start && s.date <= today) map[s.category] += s.duration;
    }
    return map;
  }, [sessions, last7Start, today]);

  const todayTotal = todayByCategory.language + todayByCategory.bible + todayByCategory.mental_health;
  const weekTotal = weekByCategory.language + weekByCategory.bible + weekByCategory.mental_health;

  const grouped = sessions.reduce((acc, s) => {
    if (!acc[s.date]) acc[s.date] = [];
    acc[s.date].push(s);
    return acc;
  }, {} as Record<string, MindfulnessSession[]>);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Mindfulness</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> Log Time</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Log Mindfulness</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Category</Label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map(c => {
                    const Icon = c.icon;
                    const active = form.category === c.key;
                    return (
                      <button
                        key={c.key}
                        onClick={() => setForm(f => ({ ...f, category: c.key }))}
                        className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border text-xs font-medium transition-all ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{c.label}</span>
                      </button>
                    );
                  })}
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
              </div>

              <div>
                <Label className="mb-2 block">Quick Picks</Label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map(min => (
                    <button
                      key={min}
                      onClick={() => setForm(f => ({ ...f, duration: String(min) }))}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        form.duration === String(min)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      }`}
                    >
                      {min} min
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="What did you focus on?" rows={2} />
              </div>

              <Button onClick={handleSubmit} disabled={saving} className="w-full">
                {saving ? "Saving..." : "Log Mindfulness"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Today summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Today</span>
            </div>
            <span className="text-sm font-bold text-primary">{todayTotal} min</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(c => {
              const Icon = c.icon;
              return (
                <div key={c.key} className={`rounded-lg ${c.bg} px-2.5 py-2 text-center`}>
                  <Icon className={`h-4 w-4 mx-auto ${c.color}`} />
                  <p className="text-base font-bold mt-1 stat-value">{todayByCategory[c.key]}</p>
                  <p className="text-[10px] text-muted-foreground">{c.label}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* This week */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">Last 7 Days</span>
            <span className="text-sm font-bold">{weekTotal} min</span>
          </div>
          <div className="space-y-2">
            {CATEGORIES.map(c => {
              const Icon = c.icon;
              const minutes = weekByCategory[c.key];
              const pct = weekTotal > 0 ? Math.round((minutes / weekTotal) * 100) : 0;
              return (
                <div key={c.key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Icon className={`h-3.5 w-3.5 ${c.color}`} />
                      {c.label}
                    </span>
                    <span className="text-muted-foreground">{minutes} min · {pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* History */}
      {Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Brain className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No mindfulness time logged yet</p>
            <p className="text-xs mt-1">Track your first session above</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, dayEntries]) => {
            const dayTotal = dayEntries.reduce((a, s) => a + s.duration, 0);
            return (
              <div key={date}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {date === today ? "Today" : format(parseISO(date), "EEE, MMM d")}
                  </p>
                  <p className="text-xs text-muted-foreground">{dayTotal} min</p>
                </div>
                <div className="space-y-2">
                  {dayEntries.map(s => {
                    const meta = categoryMeta(s.category);
                    const Icon = meta.icon;
                    return (
                      <Card key={s.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={`p-2 rounded-lg ${meta.bg}`}>
                                <Icon className={`h-4 w-4 ${meta.color}`} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-semibold">{meta.label}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.duration} min</span>
                                </div>
                                {s.notes && <p className="text-xs text-muted-foreground mt-1.5 italic">{s.notes}</p>}
                              </div>
                            </div>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => handleDelete(s.id)}
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
            );
          })
      )}
    </div>
  );
}
