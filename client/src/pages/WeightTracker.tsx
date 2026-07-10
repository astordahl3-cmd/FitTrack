import { useState, useEffect, useCallback } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { Plus, Trash2, Scale, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getWeightEntries, addWeight, deleteWeight, getProfile } from "@/lib/storage";
import type { WeightEntry, UserProfile } from "@/lib/storage";

function BodyCompChart({ entries }: { entries: WeightEntry[] }) {
  // Only entries that have at least body_fat logged
  const sorted = [...entries]
    .filter(e => e.body_fat != null || e.muscle_mass != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;

  const hasBF = sorted.some(e => e.body_fat != null);
  const hasMM = sorted.some(e => e.muscle_mass != null);

  const W = 320, H = 110;
  const PAD = { top: 12, right: hasMM ? 44 : 12, bottom: 28, left: 36 };
  const CW = W - PAD.left - PAD.right;
  const CH = H - PAD.top - PAD.bottom;
  const n = sorted.length;

  // Y domains
  const bfVals = sorted.filter(e => e.body_fat != null).map(e => e.body_fat as number);
  const mmVals = sorted.filter(e => e.muscle_mass != null).map(e => e.muscle_mass as number);
  const bfMin = bfVals.length ? Math.floor(Math.min(...bfVals) - 1) : 0;
  const bfMax = bfVals.length ? Math.ceil(Math.max(...bfVals) + 1) : 40;
  const mmMin = mmVals.length ? Math.floor(Math.min(...mmVals) - 2) : 100;
  const mmMax = mmVals.length ? Math.ceil(Math.max(...mmVals) + 2) : 200;

  const xOf = (i: number) => PAD.left + (n === 1 ? CW / 2 : (i / (n - 1)) * CW);
  const yBF = (v: number) => PAD.top + CH - ((v - bfMin) / (bfMax - bfMin)) * CH;
  const yMM = (v: number) => PAD.top + CH - ((v - mmMin) / (mmMax - mmMin)) * CH;

  // Build polyline points, skip nulls by breaking into segments
  const buildSegments = (pts: Array<{ x: number; y: number } | null>) => {
    const segs: string[] = [];
    let cur: string[] = [];
    pts.forEach(p => {
      if (p) {
        cur.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      } else {
        if (cur.length > 1) segs.push(cur.join(" "));
        cur = [];
      }
    });
    if (cur.length > 1) segs.push(cur.join(" "));
    return segs;
  };

  const bfPts = sorted.map((e, i) =>
    e.body_fat != null ? { x: xOf(i), y: yBF(e.body_fat) } : null
  );
  const mmPts = sorted.map((e, i) =>
    e.muscle_mass != null ? { x: xOf(i), y: yMM(e.muscle_mass) } : null
  );

  const bfSegs = buildSegments(bfPts);
  const mmSegs = buildSegments(mmPts);

  // Y-axis gridlines for BF (3–4 ticks)
  const bfRange = bfMax - bfMin;
  const bfStep = bfRange <= 5 ? 1 : bfRange <= 10 ? 2 : 5;
  const bfTicks = Array.from({ length: Math.ceil(bfRange / bfStep) + 1 }, (_, i) => bfMin + i * bfStep).filter(v => v <= bfMax);

  // X-axis date labels (first, last, and ~midpoint)
  const xLabels: number[] = [0];
  if (n > 2) xLabels.push(Math.floor((n - 1) / 2));
  xLabels.push(n - 1);
  const unique = [...new Set(xLabels)];

  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">Body Composition Trend</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Legend */}
        <div className="flex gap-4 mb-2">
          {hasBF && (
            <div className="flex items-center gap-1.5">
              <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="hsl(22 100% 55%)" strokeWidth="2" /></svg>
              <span className="text-xs text-muted-foreground">Body Fat %</span>
            </div>
          )}
          {hasMM && (
            <div className="flex items-center gap-1.5">
              <svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="hsl(174 88% 25%)" strokeWidth="2" strokeDasharray="4 2" /></svg>
              <span className="text-xs text-muted-foreground">Muscle Mass (lbs)</span>
            </div>
          )}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 130 }} preserveAspectRatio="xMidYMid meet">
          {/* Gridlines + BF left Y-axis */}
          {bfTicks.map(v => (
            <g key={v}>
              <line
                x1={PAD.left} y1={yBF(v)}
                x2={W - PAD.right} y2={yBF(v)}
                stroke="hsl(var(--border))" strokeWidth="0.6" strokeDasharray="3 3"
              />
              <text
                x={PAD.left - 4} y={yBF(v) + 3.5}
                textAnchor="end" fontSize="7"
                fill="hsl(var(--muted-foreground))" fontFamily="DM Sans, sans-serif"
              >
                {v}%
              </text>
            </g>
          ))}

          {/* Muscle mass right Y-axis ticks */}
          {hasMM && (() => {
            const mmRange = mmMax - mmMin;
            const mmStep = mmRange <= 10 ? 2 : mmRange <= 20 ? 5 : 10;
            const ticks = Array.from({ length: Math.ceil(mmRange / mmStep) + 1 }, (_, i) => mmMin + i * mmStep).filter(v => v <= mmMax);
            return ticks.map(v => (
              <text
                key={v}
                x={W - PAD.right + 4} y={yMM(v) + 3.5}
                textAnchor="start" fontSize="7"
                fill="hsl(174 88% 25%)" fontFamily="DM Sans, sans-serif"
              >
                {v}
              </text>
            ));
          })()}

          {/* Muscle mass line segments */}
          {hasMM && mmSegs.map((pts, i) => (
            <polyline key={i} points={pts} fill="none" stroke="hsl(174 88% 25%)"
              strokeWidth="1.8" strokeDasharray="5 3" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {hasMM && mmPts.map((p, i) =>
            p ? <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="hsl(174 88% 25%)" /> : null
          )}

          {/* Body fat line segments */}
          {hasBF && bfSegs.map((pts, i) => (
            <polyline key={i} points={pts} fill="none" stroke="hsl(22 100% 55%)"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {hasBF && bfPts.map((p, i) => {
            if (!p) return null;
            const entry = sorted[i];
            const isLatest = i === sorted.length - 1;
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="3" fill="hsl(22 100% 55%)" />
                {isLatest && entry.body_fat != null && (
                  <text
                    x={p.x} y={p.y - 6}
                    textAnchor="middle" fontSize="7.5" fontWeight="bold"
                    fill="hsl(22 100% 55%)" fontFamily="DM Sans, sans-serif"
                  >
                    {entry.body_fat.toFixed(1)}%
                  </text>
                )}
              </g>
            );
          })}

          {/* X-axis date labels */}
          {unique.map(i => (
            <text
              key={i}
              x={xOf(i)} y={H - 4}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              fontSize="7" fill="hsl(var(--muted-foreground))" fontFamily="DM Sans, sans-serif"
            >
              {format(parseISO(sorted[i].date), "MMM d")}
            </text>
          ))}
        </svg>
      </CardContent>
    </Card>
  );
}

function MiniChart({ entries, goalEnd }: { entries: WeightEntry[]; goalEnd: number }) {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const weights = sorted.map(e => e.weight);
  const minW = Math.min(...weights, goalEnd) - 2;
  const maxW = Math.max(...weights) + 2;
  const W = 100, H = 60;
  const pts = sorted.map((e, i) => {
    const x = (i / (sorted.length - 1)) * W;
    const y = H - ((e.weight - minW) / (maxW - minW)) * H;
    return `${x},${y}`;
  }).join(" ");
  const goalY = H - ((goalEnd - minW) / (maxW - minW)) * H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28 mt-1" preserveAspectRatio="none">
      <line x1="0" y1={goalY} x2={W} y2={goalY} stroke="hsl(38 92% 50%)" strokeWidth="0.8" strokeDasharray="3 2" />
      <polyline points={pts} fill="none" stroke="hsl(174 88% 25%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {sorted.map((e, i) => {
        const x = (i / (sorted.length - 1)) * W;
        const y = H - ((e.weight - minW) / (maxW - minW)) * H;
        return <circle key={i} cx={x} cy={y} r="2" fill="hsl(174 88% 25%)" />;
      })}
      <text x={W - 1} y={Math.max(goalY - 2, 6)} textAnchor="end" fontSize="5" fill="hsl(38 92% 50%)" fontFamily="DM Sans, sans-serif">{goalEnd} goal</text>
    </svg>
  );
}

export default function WeightTracker() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    weight: "",
    body_fat: "",
    muscle_mass: "",
    notes: "",
  });

  const load = useCallback(async () => {
    const [data, prof] = await Promise.all([getWeightEntries(90), getProfile()]);
    setEntries(data);
    setProfile(prof);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async () => {
    if (!form.weight) return;
    setSaving(true);
    try {
      await addWeight({
        date: form.date,
        weight: parseFloat(form.weight),
        note: form.notes || null,
        body_fat: form.body_fat ? parseFloat(form.body_fat) : null,
        muscle_mass: form.muscle_mass ? parseFloat(form.muscle_mass) : null,
      });
      await load();
      setOpen(false);
      setForm({ date: format(new Date(), "yyyy-MM-dd"), weight: "", body_fat: "", muscle_mass: "", notes: "" });
      toast({ title: "Weight logged ✓" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWeight(id);
      await load();
    } catch (e: any) {
      toast({ title: "Failed to delete", description: e?.message ?? "Unknown error", variant: "destructive" });
    }
  };

  const GOAL_START = profile?.start_weight ?? 255;
  const GOAL_END = profile?.goal_weight ?? 235;
  const GOAL_DATE = profile?.goal_date ? new Date(profile.goal_date) : new Date("2026-07-01");
  const GOAL_DATE_LABEL = GOAL_DATE.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];
  const prev = sorted[1];

  const currentWeight = latest?.weight ?? GOAL_START;
  const lbsLost = GOAL_START - currentWeight;
  const lbsToGo = currentWeight - GOAL_END;
  const pct = GOAL_START !== GOAL_END
    ? Math.max(0, Math.min(100, Math.round((lbsLost / (GOAL_START - GOAL_END)) * 100)))
    : 0;

  const daysLeft = differenceInDays(GOAL_DATE, new Date());
  const weeklyRateNeeded = daysLeft > 0 ? lbsToGo / (daysLeft / 7) : 0;
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Body Fat % <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    type="number" step="0.1" min="0" max="60"
                    value={form.body_fat}
                    onChange={e => setForm(f => ({ ...f, body_fat: e.target.value }))}
                    placeholder="e.g. 18.5"
                  />
                </div>
                <div>
                  <Label>Muscle Mass (lbs) <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    type="number" step="0.1" min="0"
                    value={form.muscle_mass}
                    onChange={e => setForm(f => ({ ...f, muscle_mass: e.target.value }))}
                    placeholder="e.g. 145.0"
                  />
                </div>
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

      {/* Body composition tiles — only shown when data exists */}
      {(latest?.body_fat != null || latest?.muscle_mass != null) && (
        <div className="grid grid-cols-2 gap-3">
          {latest?.body_fat != null && (
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Body Fat</p>
                <p className="text-xl font-bold stat-value text-orange-500">{latest.body_fat.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">latest reading</p>
              </CardContent>
            </Card>
          )}
          {latest?.muscle_mass != null && (
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Muscle Mass</p>
                <p className="text-xl font-bold stat-value text-primary">{latest.muscle_mass.toFixed(1)} lbs</p>
                <p className="text-xs text-muted-foreground">latest reading</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Body composition chart */}
      <BodyCompChart entries={entries} />

      {/* Progress card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{GOAL_START} → {GOAL_END} lbs by {GOAL_DATE_LABEL}</span>
            </div>
            <span className="text-sm font-bold text-primary">{pct}%</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden mb-3">
            <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          <MiniChart entries={entries} goalEnd={GOAL_END} />
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
          <CardTitle className="text-sm font-semibold">Milestones</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {(() => {
            const totalLbs = GOAL_START - GOAL_END;
            const steps = 5;
            const lbsPerStep = totalLbs / steps;
            const msPerStep = (GOAL_DATE.getTime() - Date.now()) / steps;
            return Array.from({ length: steps }, (_, i) => ({
              label: `Milestone ${i + 1}`,
              target: Math.round((GOAL_START - lbsPerStep * (i + 1)) * 10) / 10,
              date: new Date(Date.now() + msPerStep * (i + 1)).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            })).concat([{ label: "Goal", target: GOAL_END, date: GOAL_DATE.toLocaleDateString("en-US", { month: "short", day: "numeric" }) }]);
          })().map(m => {
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
                      {(entry.body_fat != null || entry.muscle_mass != null) && (
                        <p className="text-xs text-muted-foreground">
                          {entry.body_fat != null && `BF: ${entry.body_fat.toFixed(1)}%`}
                          {entry.body_fat != null && entry.muscle_mass != null && " · "}
                          {entry.muscle_mass != null && `MM: ${entry.muscle_mass.toFixed(1)} lbs`}
                        </p>
                      )}
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
