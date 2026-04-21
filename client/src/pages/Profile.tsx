import { useState, useEffect, useCallback } from "react";
import {
  User, Target, Scale, Flame, Beef, Wheat, Droplets,
  Save, Loader2, Calculator, ChevronDown, ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getProfile, saveProfile } from "@/lib/storage";

// ── Mifflin-St Jeor BMR ──────────────────────────────────────────────────────
// weight in lbs → convert to kg; height in inches → convert to cm
function calcBMR(sex: string, weightLbs: number, heightIn: number, age: number): number {
  const kg = weightLbs * 0.453592;
  const cm = heightIn * 2.54;
  if (sex === "male") return Math.round(10 * kg + 6.25 * cm - 5 * age + 5);
  return Math.round(10 * kg + 6.25 * cm - 5 * age - 161);
}

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary:  1.2,   // desk job, little/no exercise
  light:      1.375, // light exercise 1–3 days/week
  moderate:   1.55,  // moderate exercise 3–5 days/week
  active:     1.725, // hard exercise 6–7 days/week
  very_active: 1.9,  // very hard exercise + physical job
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary:   "Sedentary (desk job, no exercise)",
  light:       "Light (1–3 days/week)",
  moderate:    "Moderate (3–5 days/week)",
  active:      "Active (6–7 days/week)",
  very_active: "Very Active (hard daily exercise)",
};

// Safe deficit bands (lbs/week → kcal/day deficit)
const DEFICIT_OPTIONS = [
  { label: "Maintain",    lbsPerWeek: 0,    deficit: 0 },
  { label: "Lose 0.5 lb/wk", lbsPerWeek: 0.5, deficit: 250 },
  { label: "Lose 1 lb/wk",   lbsPerWeek: 1,   deficit: 500 },
  { label: "Lose 1.5 lb/wk", lbsPerWeek: 1.5, deficit: 750 },
  { label: "Lose 2 lb/wk",   lbsPerWeek: 2,   deficit: 1000 },
];

// ── Macro helpers ─────────────────────────────────────────────────────────────
function gramsToPercent(g: number, calsPerG: number, totalCals: number) {
  if (!totalCals) return 0;
  return Math.round((g * calsPerG / totalCals) * 100);
}
function percentToGrams(pct: number, calsPerG: number, totalCals: number) {
  return Math.round((pct / 100) * totalCals / calsPerG);
}

const DEFAULT_CALS      = 2200;
const DEFAULT_PROTEIN_PCT = 38;
const DEFAULT_CARB_PCT    = 24;
const DEFAULT_FAT_PCT     = 38;

// ── Height helpers ────────────────────────────────────────────────────────────
function inchesToFeetStr(inches: number) {
  const ft = Math.floor(inches / 12);
  const ins = Math.round(inches % 12);
  return `${ft}'${ins}"`;
}

export default function Profile() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calcOpen, setCalcOpen] = useState(true);

  // Personal info
  const [displayName, setDisplayName] = useState("");
  const [sex, setSex] = useState("male");
  const [heightFt, setHeightFt] = useState("5");
  const [heightIn, setHeightIn] = useState("10");
  const [birthdate, setBirthdate] = useState("");

  // Weight goal
  const [startWeight, setStartWeight] = useState("");
  const [goalWeight, setGoalWeight] = useState("");
  const [goalDate, setGoalDate] = useState("");

  // Activity + deficit
  const [activity, setActivity] = useState("moderate");
  const [deficitIdx, setDeficitIdx] = useState(2); // default 1 lb/wk

  // Calorie + macro targets
  const [calTarget, setCalTarget] = useState(DEFAULT_CALS);
  const [calInput, setCalInput] = useState(String(DEFAULT_CALS));
  const [proteinPct, setProteinPct] = useState(DEFAULT_PROTEIN_PCT);
  const [carbPct, setCarbPct]       = useState(DEFAULT_CARB_PCT);
  const [fatPct, setFatPct]         = useState(DEFAULT_FAT_PCT);

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalHeightIn = parseInt(heightFt || "0") * 12 + parseInt(heightIn || "0");
  const currentWeightLbs = parseFloat(startWeight) || 0;

  // Calculate age from birthdate
  const ageNum = (() => {
    if (!birthdate) return 0;
    const bd = new Date(birthdate);
    const today = new Date();
    let years = today.getFullYear() - bd.getFullYear();
    const m = today.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) years--;
    return years > 0 ? years : 0;
  })();

  const bmr = (sex && currentWeightLbs && totalHeightIn && ageNum)
    ? calcBMR(sex, currentWeightLbs, totalHeightIn, ageNum)
    : null;
  const tdee = bmr ? Math.round(bmr * ACTIVITY_MULTIPLIERS[activity]) : null;
  const recommendedCals = tdee
    ? Math.max(1200, tdee - DEFICIT_OPTIONS[deficitIdx].deficit)
    : null;

  // Weight loss pace from goal fields
  const weightLossSummary = (() => {
    if (!startWeight || !goalWeight) return null;
    const lbs = parseFloat(startWeight) - parseFloat(goalWeight);
    if (lbs <= 0) return null;
    if (!goalDate) return { lbs };
    const days = Math.round((new Date(goalDate).getTime() - Date.now()) / 86400000);
    if (days <= 0) return { lbs };
    return { lbs, days, perWeek: (lbs / (days / 7)).toFixed(2) };
  })();

  // Macro gram values derived from % + calorie target
  const proteinG = percentToGrams(proteinPct, 4, calTarget);
  const carbG    = percentToGrams(carbPct,    4, calTarget);
  const fatG     = percentToGrams(fatPct,     9, calTarget);
  const totalPct = proteinPct + carbPct + fatPct;

  const handleCalInput = (val: string) => {
    setCalInput(val);
    const n = parseInt(val);
    if (!isNaN(n) && n > 0) setCalTarget(n);
  };

  const applyRecommended = () => {
    if (!recommendedCals) return;
    setCalTarget(recommendedCals);
    setCalInput(String(recommendedCals));
  };

  // Slider logic: adjust other two proportionally so sum stays 100
  const handleProteinSlider = (val: number) => {
    const rem = 100 - val, other = carbPct + fatPct;
    if (!other) { setProteinPct(val); setCarbPct(Math.round(rem / 2)); setFatPct(rem - Math.round(rem / 2)); return; }
    const nc = Math.max(0, Math.round(carbPct * rem / other));
    setProteinPct(val); setCarbPct(nc); setFatPct(Math.max(0, rem - nc));
  };
  const handleCarbSlider = (val: number) => {
    const rem = 100 - val, other = proteinPct + fatPct;
    if (!other) { setCarbPct(val); setProteinPct(Math.round(rem / 2)); setFatPct(rem - Math.round(rem / 2)); return; }
    const np = Math.max(0, Math.round(proteinPct * rem / other));
    setCarbPct(val); setProteinPct(np); setFatPct(Math.max(0, rem - np));
  };
  const handleFatSlider = (val: number) => {
    const rem = 100 - val, other = proteinPct + carbPct;
    if (!other) { setFatPct(val); setProteinPct(Math.round(rem / 2)); setCarbPct(rem - Math.round(rem / 2)); return; }
    const np = Math.max(0, Math.round(proteinPct * rem / other));
    setFatPct(val); setProteinPct(np); setCarbPct(Math.max(0, rem - np));
  };

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const p = await getProfile();
      if (p) {
        setDisplayName(p.display_name ?? "");
        if (p.sex) setSex(p.sex);
        if (p.height_in) {
          setHeightFt(String(Math.floor(p.height_in / 12)));
          setHeightIn(String(Math.round(p.height_in % 12)));
        }
        if (p.birthdate) setBirthdate(p.birthdate);
        else if (p.age) {
          // Legacy: back-calculate an approximate birthdate from stored age
          const approxYear = new Date().getFullYear() - p.age;
          setBirthdate(`${approxYear}-01-01`);
        }
        if (p.activity_level) setActivity(p.activity_level);
        setStartWeight(p.start_weight != null ? String(p.start_weight) : "");
        setGoalWeight(p.goal_weight != null ? String(p.goal_weight) : "");
        setGoalDate(p.goal_date ?? "");
        const cals = p.calorie_target ?? DEFAULT_CALS;
        setCalTarget(cals); setCalInput(String(cals));
        if (p.protein_target && p.carb_target && p.fat_target) {
          const pp = gramsToPercent(p.protein_target, 4, cals);
          const cp = gramsToPercent(p.carb_target, 4, cals);
          const fp = gramsToPercent(p.fat_target, 9, cals);
          const sum = pp + cp + fp;
          if (sum > 0) { setProteinPct(pp + (100 - sum)); setCarbPct(cp); setFatPct(fp); }
        }
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProfile({
        display_name:    displayName || null,
        sex:             sex || null,
        height_in:       totalHeightIn || null,
        birthdate:       birthdate || null,
        age:             ageNum || null,
        activity_level:  activity,
        start_weight:    startWeight ? parseFloat(startWeight) : null,
        goal_weight:     goalWeight  ? parseFloat(goalWeight)  : null,
        goal_date:       goalDate || null,
        calorie_target:  calTarget,
        protein_target:  proteinG,
        carb_target:     carbG,
        fat_target:      fatG,
      });
      toast({ title: "Profile saved ✓" });
    } catch (e: any) {
      toast({ title: "Error saving", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold">My Profile</h1>
        <p className="text-sm text-muted-foreground">Your settings drive all targets across the app</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* ── Personal Info ── */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Personal Info
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div>
                <Label>Display Name</Label>
                <Input placeholder="Your name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Sex</Label>
                  <Select value={sex} onValueChange={setSex}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={birthdate}
                    onChange={e => setBirthdate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                  />
                  {ageNum > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Age: {ageNum} years old</p>
                  )}
                </div>
              </div>
              <div>
                <Label>Height</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min="3" max="8" className="w-20"
                    value={heightFt} onChange={e => setHeightFt(e.target.value)}
                  />
                  <span className="text-sm text-muted-foreground">ft</span>
                  <Input
                    type="number" min="0" max="11" className="w-20"
                    value={heightIn} onChange={e => setHeightIn(e.target.value)}
                  />
                  <span className="text-sm text-muted-foreground">in</span>
                  {totalHeightIn > 0 && (
                    <span className="text-xs text-muted-foreground ml-1">({totalHeightIn}")</span>
                  )}
                </div>
              </div>
              <div>
                <Label>Activity Level</Label>
                <Select value={activity} onValueChange={setActivity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTIVITY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* ── Weight Goal ── */}
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

          {/* ── Calorie Calculator ── */}
          <Card>
            <button
              className="w-full text-left"
              onClick={() => setCalcOpen(o => !o)}
            >
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary" /> Calorie Calculator
                    <span className="text-xs font-normal text-muted-foreground ml-1">Mifflin-St Jeor</span>
                  </span>
                  {calcOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </CardTitle>
              </CardHeader>
            </button>

            {calcOpen && (
              <CardContent className="px-4 pb-4 space-y-4">
                {bmr ? (
                  <>
                    {/* TDEE breakdown */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: "BMR", value: bmr, sub: "base metabolic rate", color: "text-muted-foreground" },
                        { label: "TDEE", value: tdee!, sub: "maintenance calories", color: "text-foreground" },
                        { label: "Recommended", value: recommendedCals!, sub: DEFICIT_OPTIONS[deficitIdx].label, color: "text-primary" },
                      ].map(item => (
                        <div key={item.label} className="rounded-lg bg-muted/50 px-2 py-3">
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className={`text-lg font-bold stat-value ${item.color}`}>{item.value.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground leading-tight mt-0.5">{item.sub}</p>
                        </div>
                      ))}
                    </div>

                    {/* Deficit selector */}
                    <div>
                      <Label className="mb-2 block">Weekly Loss Rate</Label>
                      <div className="grid grid-cols-1 gap-1.5">
                        {DEFICIT_OPTIONS.map((opt, i) => {
                          const cals = Math.max(1200, tdee! - opt.deficit);
                          return (
                            <button
                              key={i}
                              onClick={() => setDeficitIdx(i)}
                              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${
                                deficitIdx === i
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "border-border hover:border-primary/40 text-muted-foreground"
                              }`}
                            >
                              <span className="font-medium">{opt.label}</span>
                              <span className={`font-semibold stat-value ${deficitIdx === i ? "text-primary" : ""}`}>
                                {cals.toLocaleString()} kcal/day
                                {opt.deficit > 0 && (
                                  <span className="font-normal text-muted-foreground ml-1">
                                    (−{opt.deficit} deficit)
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Apply button */}
                    <Button
                      variant="outline"
                      className="w-full border-primary text-primary hover:bg-primary/10"
                      onClick={applyRecommended}
                    >
                      Apply {recommendedCals?.toLocaleString()} kcal to My Target
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    <Calculator className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Fill in sex, age, height, and current weight above</p>
                    <p className="text-xs mt-1">to calculate your recommended intake</p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* ── Macro Targets ── */}
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
                    type="number" className="w-32"
                    value={calInput} onChange={e => handleCalInput(e.target.value)}
                    placeholder="2200"
                  />
                  <span className="text-sm text-muted-foreground">kcal / day</span>
                  {recommendedCals && recommendedCals !== calTarget && (
                    <button
                      onClick={applyRecommended}
                      className="text-xs text-primary underline underline-offset-2 hover:text-primary/80"
                    >
                      Use {recommendedCals.toLocaleString()} (recommended)
                    </button>
                  )}
                </div>
              </div>

              {/* Stacked bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Macro split</span>
                  <span className={totalPct === 100 ? "text-primary font-semibold" : "text-red-500 font-semibold"}>
                    {totalPct}% total
                  </span>
                </div>
                <div className="h-4 rounded-full bg-muted overflow-hidden flex">
                  <div className="h-full bg-primary transition-all duration-200" style={{ width: `${proteinPct}%` }} />
                  <div className="h-full bg-yellow-400 transition-all duration-200" style={{ width: `${carbPct}%` }} />
                  <div className="h-full bg-red-400 transition-all duration-200" style={{ width: `${fatPct}%` }} />
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-primary" />Protein</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-yellow-400" />Carbs</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-red-400" />Fat</span>
                </div>
              </div>

              {/* Protein slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5"><Beef className="h-3.5 w-3.5 text-primary" />Protein</Label>
                  <div className="text-sm text-right">
                    <span className="font-bold text-primary">{proteinPct}%</span>
                    <span className="text-muted-foreground ml-2">{proteinG}g · {Math.round(proteinPct / 100 * calTarget)} kcal</span>
                  </div>
                </div>
                <Slider min={0} max={100} step={1} value={[proteinPct]} onValueChange={([v]) => handleProteinSlider(v)} />
              </div>

              {/* Carb slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5"><Wheat className="h-3.5 w-3.5 text-yellow-500" />Carbohydrates</Label>
                  <div className="text-sm text-right">
                    <span className="font-bold text-yellow-500">{carbPct}%</span>
                    <span className="text-muted-foreground ml-2">{carbG}g · {Math.round(carbPct / 100 * calTarget)} kcal</span>
                  </div>
                </div>
                <Slider min={0} max={100} step={1} value={[carbPct]} onValueChange={([v]) => handleCarbSlider(v)} />
              </div>

              {/* Fat slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5"><Droplets className="h-3.5 w-3.5 text-red-400" />Fat</Label>
                  <div className="text-sm text-right">
                    <span className="font-bold text-red-400">{fatPct}%</span>
                    <span className="text-muted-foreground ml-2">{fatG}g · {Math.round(fatPct / 100 * calTarget)} kcal</span>
                  </div>
                </div>
                <Slider min={0} max={100} step={1} value={[fatPct]} onValueChange={([v]) => handleFatSlider(v)} />
              </div>

              {/* Summary table */}
              <div className="rounded-lg bg-muted/50 divide-y divide-border overflow-hidden text-sm">
                {[
                  { label: "Protein", pct: proteinPct, g: proteinG, kcal: Math.round(proteinPct / 100 * calTarget), color: "text-primary" },
                  { label: "Carbs",   pct: carbPct,    g: carbG,    kcal: Math.round(carbPct / 100 * calTarget),    color: "text-yellow-500" },
                  { label: "Fat",     pct: fatPct,     g: fatG,     kcal: Math.round(fatPct / 100 * calTarget),     color: "text-red-400" },
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
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              : <><Save className="h-4 w-4 mr-2" />Save Profile</>
            }
          </Button>
        </>
      )}
    </div>
  );
}
