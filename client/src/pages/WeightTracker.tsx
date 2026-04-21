import { useState, useEffect, useCallback } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { Plus, Trash2, Scale, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getWeightEntries, addWeight, deleteWeight } from "@/lib/storage";
import type { WeightEntry } from "@/lib/storage";

const GOAL_START = 255;
const GOAL_END = 235;
const GOAL_DATE = new Date("2026-07-01");

function MiniChart({ entries }: { entries: WeightEntry[] }) {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const weights = sorted.map(e => e.weight);
  const minW = Math.min(...weights) - 2;
  const maxW = Math.max(...weights) + 2;
  const W = 100, H = 60;
  const pts = sorted.map((e, i) => {
    const x = (i / (sorted.length - 1)) * W;
    const y = H - ((e.weight - minW) / (maxW - minW)) * H;
    return `${x},${y}`;
  }).join(" ");
  const goalY = H - ((GOAL_END - minW) / (maxW - minW)) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28 mt-1" preserveAspectRatio="none">
      <line x1="0" y1={goalY} x2={W} y2={goalY} stroke="hsl(38 92% 50%)" strokeWidth="0.8" strokeDasharray="3 2" />
      <polyline points={pts} fill="none" stroke="hsl(174 88% 25%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {sorted.map((e, i) => {
        const x = (i / (sorted.length - 1)) * W;
        const y = H - ((e.weight - minW) / (maxW - minW)) * H;
        return <circle key={i} cx={x} cy={y} r="2" fill="hsl(174 88% 25%)" />;
      })}
      <text x={W - 1} y={goalY - 2} textAnchor="end" fontSize="5" fill="hsl(38 92% 50%)" fontFamily="DM Sans, sans-serif">235 goal</text>
    </svg>
  );
}

export default function WeightTracker() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    weight: "",
    notes: "",
  });

  const load = useCallback(() => setEntries(getWeightEntries(90)), []);
  useEffect(() => { load(); }, [load]);

  const handleSubmit = () => {
    if (!form.weight) return;
    setSaving(true);
    addWeight({
      date: form.date,
      weight: parseFloat(form.weight),
      note: form.notes || null,
    });
    load();
    setOpen(false);
    setForm({ date: format(new Date(), "yyyy-MM-dd"), weight: "", notes: "" });
    setSaving(false);
    toast({ title: "Weight logged ✓" });
  };

  const handleDelete = (id: number) => {
    deleteWeight(id);
    load();
  };

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];
  const prev = sorted[1];

  const currentWeight = latest?.weight ?? GOAL_START;
  const lbsLost = GOAL_START - currentWeight;
  const lbsToGo = currentWeight - GOAL_END;
  const pct = Math.max(0, Math.min(100, Math.round((lbsLost / (GOAL_START - GOAL_END)) * 100)));

  const daysLeft = differenceInDays(GOAL_DATE, new Date());
  const weeklyRateNeeded = lbsToGo / (daysLeft / 7);
  const weeklyActual = entries.length >= 7 ? (() => {
    const recent = sorted.slice(0, 7);
    const oldest = recent[recent.length - 1];
    return (oldest.weight - (latest?.weight ?? oldest.weight)) / (recent.length / 7);
  })() : null;

  const change = latest && prev ? (prev.weight - latest.weight) : null;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Weight Tracker</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> Log Weight</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Log Weight</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label>Weight (lbs)</Label>
                <Input
                  type="number" step="0.1"
                  value={form.weight}
                  onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                  placeholder="e.g. 253.4"
                />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Post-workout, morning" />
              </div>
              <Button onClick={handleSubmit} disabled={saving} className="w-full">
                {saving ? "Saving..." : "Log Weight"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Current</p>
            <p className="text-xl font-bold stat-value">{latest?.weight ?? "—"}</p>
            <p className="text-xs text-muted-foreground">lbs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Lost</p>
            <p className={`text-xl font-bold stat-value ${lbsLost > 0 ? "text-primary" : "text-muted-foreground"}`}>
              {lbsLost > 0 ? `-${lbsLost.toFixed(1)}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">lbs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">To Goal</p>
            <p className="text-xl font-bold stat-value text-orange-500">{lbsToGo > 0 ? lbsToGo.toFixed(1) : "✓"}</p>
            <p className="text-xs text-muted-foreground">lbs</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">255 → 235 lbs by July 1</span>
            </div>
            <span className="text-sm font-bold text-primary">{pct}%</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden mb-3">
            <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          <MiniChart entries={entries} />
          <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
            <div className="bg-muted rounded-lg px-3 py-2">
              <p className="text-muted-foreground">Days left</p>
              <p className="font-bold text-sm stat-value">{daysLeft}</p>
            </div>
            <div className="bg-muted rounded-lg px-3 py-2">
              <p className="text-muted-foreground">Need / week</p>
              <p className="font-bold text-sm stat-value">{weeklyRateNeeded.toFixed(1)} lbs</p>
            </div>
            {weeklyActual !== null && (
              <div className="bg-muted rounded-lg px-3 py-2">
                <p className="text-muted-foreground">Actual / week</p>
                <p className={`font-bold text-sm stat-value ${weeklyActual >= weeklyRateNeeded ? "text-primary" : "text-orange-500"}`}>
                  {weeklyActual.toFixed(1)} lbs
                </p>
              </div>
            )}
            {change !== null && (
              <div className="bg-muted rounded-lg px-3 py-2">
                <p className="text-muted-foreground">Last change</p>
                <p className={`font-bold text-sm stat-value ${change > 0 ? "text-primary" : change < 0 ? "text-red-500" : ""}`}>
                  {change > 0 ? `-${change.toFixed(1)}` : change < 0 ? `+${Math.abs(change).toFixed(1)}` : "—"} lbs
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">10-Week Milestones</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {[
            { label: "Wk 1–2", target: 252, date: "May 4" },
            { label: "Wk 3–4", target: 249, date: "May 18" },
            { label: "Wk 5–6", target: 245, date: "Jun 1" },
            { label: "Wk 7–8", target: 241, date: "Jun 15" },
            { label: "Wk 9–10", target: 237, date: "Jun 29" },
            { label: "Goal", target: 235, date: "Jul 1" },
          ].map(m => {
            const hit = currentWeight <= m.target;
            return (
              <div key={m.label} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${hit ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                    {hit ? "✓" : "○"}
                  </div>
                  <div>
                    <span className="text-sm font-medium">{m.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{m.date}</span>
                  </div>
                </div>
                <span className={`text-sm font-semibold stat-value ${hit ? "text-primary" : "text-muted-foreground"}`}>
                  {m.target} lbs
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Weight history */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">History</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {sorted.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Scale className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No entries yet — log your weight to start</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sorted.map((entry, i) => {
                const nextEntry = sorted[i + 1];
                const delta = nextEntry ? entry.weight - nextEntry.weight : null;
                return (
                  <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 group">
                    <div>
                      <p className="text-sm font-medium">{format(parseISO(entry.date), "EEE, MMM d")}</p>
                      {entry.note && <p className="text-xs text-muted-foreground">{entry.note}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-bold stat-value">{entry.weight} lbs</p>
                        {delta !== null && (
                          <p className={`text-xs stat-value ${delta < 0 ? "text-primary" : delta > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                            {delta < 0 ? `↓${Math.abs(delta).toFixed(1)}` : delta > 0 ? `↑${delta.toFixed(1)}` : "same"}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                        onClick={() => handleDelete(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
