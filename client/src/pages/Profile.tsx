import { useState, useEffect, useCallback } from "react";
import { User, Target, Scale, Flame, Beef, Wheat, Droplets, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getProfile, saveProfile } from "@/lib/storage";
import type { UserProfile } from "@/lib/storage";

const FIELD_DEFAULTS = {
  display_name: "",
  start_weight: "",
  goal_weight: "",
  goal_date: "",
  calorie_target: "2200",
  protein_target: "210",
  carb_target: "130",
  fat_target: "90",
};

export default function Profile() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(FIELD_DEFAULTS);

  const load = useCallback(async () => {
    try {
      const profile = await getProfile();
      if (profile) {
        setForm({
          display_name: profile.display_name ?? "",
          start_weight: profile.start_weight != null ? String(profile.start_weight) : "",
          goal_weight: profile.goal_weight != null ? String(profile.goal_weight) : "",
          goal_date: profile.goal_date ?? "",
          calorie_target: profile.calorie_target != null ? String(profile.calorie_target) : "2200",
          protein_target: profile.protein_target != null ? String(profile.protein_target) : "210",
          carb_target: profile.carb_target != null ? String(profile.carb_target) : "130",
          fat_target: profile.fat_target != null ? String(profile.fat_target) : "90",
        });
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
        display_name: form.display_name || null,
        start_weight: form.start_weight ? parseFloat(form.start_weight) : null,
        goal_weight: form.goal_weight ? parseFloat(form.goal_weight) : null,
        goal_date: form.goal_date || null,
        calorie_target: form.calorie_target ? parseInt(form.calorie_target) : 2200,
        protein_target: form.protein_target ? parseInt(form.protein_target) : 210,
        carb_target: form.carb_target ? parseInt(form.carb_target) : 130,
        fat_target: form.fat_target ? parseInt(form.fat_target) : 90,
      });
      toast({ title: "Profile saved ✓" });
    } catch (e: any) {
      toast({ title: "Error saving profile", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const f = (field: keyof typeof form) => ({
    value: form[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value })),
  });

  // Calculate macro calories for the preview
  const proteinCals = (parseInt(form.protein_target) || 0) * 4;
  const carbCals = (parseInt(form.carb_target) || 0) * 4;
  const fatCals = (parseInt(form.fat_target) || 0) * 9;
  const totalMacroCals = proteinCals + carbCals + fatCals;
  const calTarget = parseInt(form.calorie_target) || 0;
  const calDiff = calTarget - totalMacroCals;

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold">My Profile</h1>
        <p className="text-sm text-muted-foreground">Customize your targets — changes apply immediately across the app</p>
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
            <CardContent className="px-4 pb-4 space-y-3">
              <div>
                <Label>Display Name</Label>
                <Input placeholder="Your name" {...f("display_name")} />
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
                  <Input type="number" step="0.1" placeholder="e.g. 255" {...f("start_weight")} />
                </div>
                <div>
                  <Label>Goal Weight (lbs)</Label>
                  <Input type="number" step="0.1" placeholder="e.g. 235" {...f("goal_weight")} />
                </div>
              </div>
              <div>
                <Label>Goal Date</Label>
                <Input type="date" {...f("goal_date")} />
              </div>
              {form.start_weight && form.goal_weight && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5 text-sm">
                  <span className="text-muted-foreground">Target loss: </span>
                  <span className="font-semibold text-primary">
                    {(parseFloat(form.start_weight) - parseFloat(form.goal_weight)).toFixed(1)} lbs
                  </span>
                  {form.goal_date && (() => {
                    const days = Math.round((new Date(form.goal_date).getTime() - Date.now()) / 86400000);
                    const weeks = days / 7;
                    const lbs = parseFloat(form.start_weight) - parseFloat(form.goal_weight);
                    return days > 0 ? (
                      <span className="text-muted-foreground ml-2">
                        · {(lbs / weeks).toFixed(2)} lbs/week needed · {days} days left
                      </span>
                    ) : null;
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Daily Targets */}
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Daily Targets
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div>
                <Label className="flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-blue-500" /> Calories (kcal)
                </Label>
                <Input type="number" placeholder="e.g. 2200" {...f("calorie_target")} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Beef className="h-3.5 w-3.5 text-primary" /> Protein (g)
                  </Label>
                  <Input type="number" placeholder="e.g. 210" {...f("protein_target")} />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Wheat className="h-3.5 w-3.5 text-yellow-500" /> Carbs (g)
                  </Label>
                  <Input type="number" placeholder="e.g. 130" {...f("carb_target")} />
                </div>
                <div>
                  <Label className="flex items-center gap-1.5">
                    <Droplets className="h-3.5 w-3.5 text-red-400" /> Fat (g)
                  </Label>
                  <Input type="number" placeholder="e.g. 90" {...f("fat_target")} />
                </div>
              </div>

              {/* Macro calorie breakdown preview */}
              {(proteinCals + carbCals + fatCals) > 0 && (
                <div className="rounded-lg bg-muted/50 px-3 py-2.5 space-y-1.5 text-xs">
                  <p className="font-semibold text-foreground">Macro breakdown</p>
                  <div className="flex gap-4 text-muted-foreground">
                    <span>Protein: {proteinCals} kcal</span>
                    <span>Carbs: {carbCals} kcal</span>
                    <span>Fat: {fatCals} kcal</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                    {totalMacroCals > 0 && (
                      <>
                        <div className="h-full bg-primary transition-all" style={{ width: `${(proteinCals / totalMacroCals) * 100}%` }} />
                        <div className="h-full bg-yellow-400 transition-all" style={{ width: `${(carbCals / totalMacroCals) * 100}%` }} />
                        <div className="h-full bg-red-400 transition-all" style={{ width: `${(fatCals / totalMacroCals) * 100}%` }} />
                      </>
                    )}
                  </div>
                  <p className={`font-medium ${Math.abs(calDiff) < 50 ? "text-primary" : calDiff < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                    {totalMacroCals} kcal from macros
                    {calDiff !== 0 && ` (${calDiff > 0 ? "+" : ""}${calDiff} vs calorie target)`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : <><Save className="h-4 w-4 mr-2" /> Save Profile</>}
          </Button>
        </>
      )}
    </div>
  );
}
