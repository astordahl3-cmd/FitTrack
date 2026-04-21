import { useState, useEffect, useCallback } from "react";
import { User, Target, Scale, Flame, Beef, Wheat, Droplets, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { getProfile, saveProfile } from "@/lib/storage";
import type { UserProfile } from "@/lib/storage";

// Convert grams → % of calorie target
function gramsToPercent(grams: number, calsPerGram: number, totalCals: number): number {
  if (!totalCals) return 0;
  return Math.round((grams * calsPerGram / totalCals) * 100);
}

// Convert % of calorie target → grams
function percentToGrams(pct: number, calsPerGram: number, totalCals: number): number {
  return Math.round((pct / 100) * totalCals / calsPerGram);
}

const DEFAULT_CALS = 2200;
const DEFAULT_PROTEIN_PCT = 38; // ~210g @ 2200 kcal
const DEFAULT_CARB_PCT = 24;    // ~130g @ 2200 kcal
const DEFAULT_FAT_PCT = 38;     // ~93g @ 2200 kcal  (rounds to 100 total)

export default function Profile() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Basic fields
  const [displayName, setDisplayName] = useState("");
  const [startWeight, setStartWeight] = useState("");
  const [goalWeight, setGoalWeight] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [calTarget, setCalTarget] = useState(DEFAULT_CALS);
  const [calInput, setCalInput] = useState(String(DEFAULT_CALS));

  // Macro percentages — always sum to 100
  const [proteinPct, setProteinPct] = useState(DEFAULT_PROTEIN_PCT);
  const [carbPct, setCarbPct] = useState(DEFAULT_CARB_PCT);
  const [fatPct, setFatPct] = useState(DEFAULT_FAT_PCT);

  // Derived gram values (read-only, computed from % + calories)
  const proteinG = percentToGrams(proteinPct, 4, calTarget);
  const carbG = percentToGrams(carbPct, 4, calTarget);
  const fatG = percentToGrams(fatPct, 9, calTarget);

  const proteinCals = proteinPct / 100 * calTarget;
  const carbCals = carbPct / 100 * calTarget;
  const fatCals = fatPct / 100 * calTarget;
  const totalPct = proteinPct + carbPct + fatPct;

  // When user changes calorie input, update the number
  const handleCalInput = (val: string) => {
    setCalInput(val);
    const n = parseInt(val);
    if (!isNaN(n) && n > 0) setCalTarget(n);
  };

  // Slider handlers — adjust the other two proportionally so total stays 100
  const handleProteinSlider = (val: number) => {
    const delta = val - proteinPct;
    const remaining = 100 - val;
    const currentOther = carbPct + fatPct;
    if (currentOther === 0) {
      setProteinPct(val);
      setCarbPct(Math.round(remaining / 2));
      setFatPct(remaining - Math.round(remaining / 2));
    } else {
      const newCarb = Math.max(0, Math.round(carbPct * remaining / currentOther));
      const newFat = Math.max(0, remaining - newCarb);
      setProteinPct(val);
      setCarbPct(newCarb);
      setFatPct(newFat);
    }
  };

  const handleCarbSlider = (val: number) => {
    const remaining = 100 - val;
    const currentOther = proteinPct + fatPct;
    if (currentOther === 0) {
      setCarbPct(val);
      setProteinPct(Math.round(remaining / 2));
      setFatPct(remaining - Math.round(remaining / 2));
    } else {
      const newProtein = Math.max(0, Math.round(proteinPct * remaining / currentOther));
      const newFat = Math.max(0, remaining - newProtein);
      setCarbPct(val);
      setProteinPct(newProtein);
      setFatPct(newFat);
    }
  };

  const handleFatSlider = (val: number) => {
    const remaining = 100 - val;
    const currentOther = proteinPct + carbPct;
    if (currentOther === 0) {
      setFatPct(val);
      setProteinPct(Math.round(remaining / 2));
      setCarbPct(remaining - Math.round(remaining / 2));
    } else {
      const newProtein = Math.max(0, Math.round(proteinPct * remaining / currentOther));
      const newCarb = Math.max(0, remaining - newProtein);
      setFatPct(val);
      setProteinPct(newProtein);
      setCarbPct(newCarb);
    }
  };

  const load = useCallback(async () => {
    try {
      const profile = await getProfile();
      if (profile) {
        setDisplayName(profile.display_name ?? "");
        setStartWeight(profile.start_weight != null ? String(profile.start_weight) : "");
        setGoalWeight(profile.goal_weight != null ? String(profile.goal_weight) : "");
        setGoalDate(profile.goal_date ?? "");
        const cals = profile.calorie_target ?? DEFAULT_CALS;
        setCalTarget(cals);
        setCalInput(String(cals));
        // Convert saved grams back to percentages
        if (profile.protein_target && profile.carb_target && profile.fat_target) {
          const pp = gramsToPercent(profile.protein_target, 4, cals);
          const cp = gramsToPercent(profile.carb_target, 4, cals);
          const fp = gramsToPercent(profile.fat_target, 9, cals);
          const sum = pp + cp + fp;
          // Normalize to exactly 100 (rounding can shift by 1-2)
          if (sum > 0) {
            const adj = 100 - sum;
            setProteinPct(pp + adj); // give any rounding remainder to protein
            setCarbPct(cp);
            setFatPct(fp);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProfile({
        display_name: displayName || null,
        start_weight: startWeight ? parseFloat(startWeight) : null,
        goal_weight: goalWeight ? parseFloat(goalWeight) : null,
        goal_date: goalDate || null,
        calorie_target: calTarget,
        protein_target: proteinG,
        carb_target: carbG,
        fat_target: fatG,
      });
      toast({ title: "Profile saved ✓" });
    } catch (e: any) {
      toast({ title: "Error saving profile", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Weight loss pace preview
  const weightLossSummary = (() => {
    if (!startWeight || !goalWeight) return null;
    const lbs = parseFloat(startWeight) - parseFloat(goalWeight);
    if (!goalDate || lbs <= 0) return { lbs };
    const days = Math.round((new Date(goalDate).getTime() - Date.now()) / 86400000);
    if (days <= 0) return { lbs };
    return { lbs, days, perWeek: (lbs / (days / 7)).toFixed(2) };
  })();

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold">My Profile</h1>
        <p className="text-sm text-muted-foreground">Set your targets — everything updates across the app instantly</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Personal Info */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Personal Info
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div>
                <Label>Display Name</Label>
                <Input
                  placeholder="Your name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Weight Goal */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" /> Weight Goal
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Starting Weight (lbs)</Label>
                  <Input type="number" step="0.1" placeholder="e.g. 255"
                    value={startWeight} onChange={e => setStartWeight(e.target.value)} />
                </div>
                <div>
                  <Label>Goal Weight (lbs)</Label>
                  <Input type="number" step="0.1" placeholder="e.g. 235"
                    value={goalWeight} onChange={e => setGoalWeight(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Goal Date</Label>
                <Input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} />
              </div>
              {weightLossSummary && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5 text-sm">
                  <span className="text-muted-foreground">Target loss: </span>
                  <span className="font-semibold text-primary">{weightLossSummary.lbs.toFixed(1)} lbs</span>
                  {weightLossSummary.perWeek && (
                    <span className="text-muted-foreground ml-2">
                      · {weightLossSummary.perWeek} lbs/week · {weightLossSummary.days} days left
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daily Targets */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Daily Macro Targets
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-5 space-y-5">

              {/* Calorie input */}
              <div>
                <Label className="flex items-center gap-1.5 mb-1.5">
                  <Flame className="h-3.5 w-3.5 text-blue-500" /> Daily Calories
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    className="w-32"
                    value={calInput}
                    onChange={e => handleCalInput(e.target.value)}
                    placeholder="2200"
                  />
                  <span className="text-sm text-muted-foreground">kcal / day</span>
                </div>
              </div>

              {/* Stacked bar preview */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Macro split</span>
                  <span className={totalPct === 100 ? "text-primary font-semibold" : "text-red-500 font-semibold"}>
                    {totalPct}% total
                  </span>
                </div>
                <div className="h-4 rounded-full bg-muted overflow-hidden flex">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${proteinPct}%` }}
                    title={`Protein ${proteinPct}%`}
                  />
                  <div
                    className="h-full bg-yellow-400 transition-all duration-200"
                    style={{ width: `${carbPct}%` }}
                    title={`Carbs ${carbPct}%`}
                  />
                  <div
                    className="h-full bg-red-400 transition-all duration-200"
                    style={{ width: `${fatPct}%` }}
                    title={`Fat ${fatPct}%`}
                  />
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-primary" /> Protein</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-yellow-400" /> Carbs</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-red-400" /> Fat</span>
                </div>
              </div>

              {/* Protein slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Beef className="h-3.5 w-3.5 text-primary" /> Protein
                  </Label>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold text-primary w-10 text-right">{proteinPct}%</span>
                    <span className="text-muted-foreground w-20 text-right">{proteinG}g · {Math.round(proteinCals)} kcal</span>
                  </div>
                </div>
                <Slider
                  min={0} max={100} step={1}
                  value={[proteinPct]}
                  onValueChange={([v]) => handleProteinSlider(v)}
                  className="[&>[data-slot=track]]:bg-primary/20 [&>[data-slot=range]]:bg-primary [&>[data-slot=thumb]]:border-primary"
                />
              </div>

              {/* Carbs slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Wheat className="h-3.5 w-3.5 text-yellow-500" /> Carbohydrates
                  </Label>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold text-yellow-500 w-10 text-right">{carbPct}%</span>
                    <span className="text-muted-foreground w-20 text-right">{carbG}g · {Math.round(carbCals)} kcal</span>
                  </div>
                </div>
                <Slider
                  min={0} max={100} step={1}
                  value={[carbPct]}
                  onValueChange={([v]) => handleCarbSlider(v)}
                  className="[&>[data-slot=track]]:bg-yellow-100 dark::[&>[data-slot=track]]:bg-yellow-900/30 [&>[data-slot=range]]:bg-yellow-400 [&>[data-slot=thumb]]:border-yellow-400"
                />
              </div>

              {/* Fat slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Droplets className="h-3.5 w-3.5 text-red-400" /> Fat
                  </Label>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-bold text-red-400 w-10 text-right">{fatPct}%</span>
                    <span className="text-muted-foreground w-20 text-right">{fatG}g · {Math.round(fatCals)} kcal</span>
                  </div>
                </div>
                <Slider
                  min={0} max={100} step={1}
                  value={[fatPct]}
                  onValueChange={([v]) => handleFatSlider(v)}
                  className="[&>[data-slot=track]]:bg-red-100 dark::[&>[data-slot=track]]:bg-red-900/30 [&>[data-slot=range]]:bg-red-400 [&>[data-slot=thumb]]:border-red-400"
                />
              </div>

              {/* Summary table */}
              <div className="rounded-lg bg-muted/50 divide-y divide-border overflow-hidden text-sm">
                {[
                  { label: "Protein", pct: proteinPct, g: proteinG, kcal: Math.round(proteinCals), color: "text-primary" },
                  { label: "Carbs",   pct: carbPct,    g: carbG,    kcal: Math.round(carbCals),    color: "text-yellow-500" },
                  { label: "Fat",     pct: fatPct,     g: fatG,     kcal: Math.round(fatCals),     color: "text-red-400" },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between px-3 py-2">
                    <span className={`font-medium ${row.color} w-20`}>{row.label}</span>
                    <span className="text-muted-foreground">{row.pct}%</span>
                    <span className="font-semibold w-14 text-right">{row.g}g</span>
                    <span className="text-muted-foreground w-20 text-right">{row.kcal} kcal</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 font-semibold">
                  <span className="w-20">Total</span>
                  <span className={totalPct === 100 ? "text-primary" : "text-red-500"}>{totalPct}%</span>
                  <span className="w-14 text-right">{proteinG + carbG + fatG}g</span>
                  <span className="w-20 text-right">{calTarget} kcal</span>
                </div>
              </div>

            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
            {saving
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              : <><Save className="h-4 w-4 mr-2" /> Save Profile</>
            }
          </Button>
        </>
      )}
    </div>
  );
}
