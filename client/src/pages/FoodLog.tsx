import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { Plus, Trash2, ChevronLeft, ChevronRight, Search, BookOpen, Pencil, ScanBarcode, Loader2, Flag, Camera, X, AlertTriangle } from "lucide-react";
import BarcodeScanner from "@/components/BarcodeScanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  getFoodByDate, addFood, deleteFood,
  getFoodLibrary, addFoodLibraryItem, updateFoodLibraryItem, deleteFoodLibraryItem,
  getProfile,
} from "@/lib/storage";
import type { FoodEntry, FoodLibraryItem, UserProfile } from "@/lib/storage";

const MEAL_TIMES = ["6 AM", "7 AM", "8 AM", "9 AM", "10 AM", "11 AM", "Noon", "1 PM", "2 PM", "3 PM", "4 PM", "5 PM", "6 PM", "7 PM", "8 PM", "9 PM", "10 PM", "Other"];
const EMPTY_LIB_FORM = { name: "", calories: "", protein: "", carbs: "", fat: "", fiber: "", servingSize: "", category: "" };
const CATEGORIES = [
  "All",
  "🥤 Shakes & Supplements",
  "🥩 Proteins",
  "🥚 Eggs & Dairy",
  "🍎 Fruits",
  "🥦 Vegetables",
  "Other",
];

export default function FoodLog() {
  const { toast } = useToast();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [library, setLibrary] = useState<FoodLibraryItem[]>([]);

  const [profile, setProfile] = useState<UserProfile | null>(null);

  const loadProfile = useCallback(async () => {
    const p = await getProfile();
    setProfile(p);
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const CALORIE_TARGET = profile?.calorie_target ?? 2200;
  const PROTEIN_TARGET = profile?.protein_target ?? 210;

  const [logOpen, setLogOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  // Stores raw OFF response for the last scan — used by the "Flag bad data" button
  const [lastScanRaw, setLastScanRaw] = useState<{
    barcode: string;
    productName: string;
    rawNutriments: Record<string, any>;
    parsedKcal: number;
    parsedProtein: number;
    parsedCarbs: number;
    parsedFat: number;
  } | null>(null);

  // AI photo analysis state
  const [photoAnalyzing, setPhotoAnalyzing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoResult, setPhotoResult] = useState<{
    foods: { name: string; portion: string; calories: number; protein: number; carbs: number; fat: number }[];
    totals: { calories: number; protein: number; carbs: number; fat: number };
    confidence: 'low' | 'medium' | 'high';
    notes: string;
  } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [libSearch, setLibSearch] = useState("");
  const [libCategory, setLibCategory] = useState("All");
  const [editItem, setEditItem] = useState<FoodLibraryItem | null>(null);
  const [libForm, setLibForm] = useState(EMPTY_LIB_FORM);
  const [form, setForm] = useState({ meal: "Noon", name: "", calories: "", protein: "", carbs: "", fat: "", fiber: "" });
  // Serving size: "1" = 1 full serving, "0.5" = half, custom number allowed
  const [servingQty, setServingQty] = useState("1");
  const [servingUnit, setServingUnit] = useState(""); // e.g. "banana", "oz of milk" — from library serving_size
  const [baseForm, setBaseForm] = useState<{ calories: string; protein: string; carbs: string; fat: string; fiber: string } | null>(null); // per-1-serving values from library

  const loadEntries = useCallback(async () => {
    const data = await getFoodByDate(date);
    setEntries(data);
  }, [date]);

  const loadLibrary = useCallback(async () => {
    const data = await getFoodLibrary();
    setLibrary(data);
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);
  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  // Recompute macros whenever serving qty changes
  const applyServing = (qty: string, base: typeof baseForm) => {
    if (!base) return;
    const q = parseFloat(qty) || 1;
    setForm(f => ({
      ...f,
      calories: String(Math.round(parseFloat(base.calories) * q)),
      protein:  String(Math.round(parseFloat(base.protein)  * q * 10) / 10),
      carbs:    base.carbs  ? String(Math.round(parseFloat(base.carbs)  * q * 10) / 10) : "",
      fat:      base.fat    ? String(Math.round(parseFloat(base.fat)    * q * 10) / 10) : "",
      fiber:    base.fiber  ? String(Math.round(parseFloat(base.fiber)  * q * 10) / 10) : "",
    }));
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const totals = entries.reduce(
    (acc, e) => ({ cal: acc.cal + e.calories, prot: acc.prot + e.protein, fiber: acc.fiber + (e.fiber ?? 0) }),
    { cal: 0, prot: 0, fiber: 0 }
  );

  const filteredLibrary = library.filter(l => l.name.toLowerCase().includes(search.toLowerCase()));
  const filteredLibAll = library.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(libSearch.toLowerCase());
    const matchesCategory = libCategory === "All" || (l.category ?? "Other") === libCategory;
    return matchesSearch && matchesCategory;
  });

  const mealGroups = MEAL_TIMES.reduce((acc, meal) => {
    const items = entries.filter(e => e.meal === meal);
    if (items.length) acc[meal] = items;
    return acc;
  }, {} as Record<string, FoodEntry[]>);

  // ── Actions ───────────────────────────────────────────────────────────────
  const fillFromLibrary = (item: FoodLibraryItem) => {
    const base = {
      calories: String(item.calories),
      protein:  String(item.protein),
      carbs:    String(item.carbs  ?? ""),
      fat:      String(item.fat    ?? ""),
      fiber:    String(item.fiber  ?? ""),
    };
    setBaseForm(base);
    setServingQty("1");
    setServingUnit(item.serving_size ?? "");
    setForm(f => ({ ...f, name: item.name, ...base }));
    setSearch("");
  };

  const [logSaving, setLogSaving] = useState(false);

  const handleLogSubmit = async () => {
    if (!form.name || !form.calories || !form.protein) return;
    setLogSaving(true);
    try {
      await addFood({
        date, meal: form.meal, name: form.name,
        calories: parseInt(form.calories),
        protein: parseFloat(form.protein),
        carbs: form.carbs ? parseFloat(form.carbs) : null,
        fat: form.fat ? parseFloat(form.fat) : null,
        fiber: form.fiber ? parseFloat(form.fiber) : null,
      });
      await loadEntries();
      setLogOpen(false);
      setForm({ meal: "Noon", name: "", calories: "", protein: "", carbs: "", fat: "", fiber: "" });
      setBaseForm(null);
      setServingQty("1");
      setServingUnit("");
      setBarcodeError(null);
      setLastScanRaw(null);
      setPhotoResult(null);
      setPhotoPreview(null);
      setPhotoError(null);
      toast({ title: "Food logged ✓" });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setLogSaving(false);
    }
  };

  const handleDeleteFood = async (id: string) => {
    try {
      await deleteFood(id);
      await loadEntries();
    } catch (e: any) {
      toast({ title: "Failed to delete", description: e?.message ?? "Unknown error", variant: "destructive" });
    }
  };

  const [libSaving, setLibSaving] = useState(false);

  const handleLibSubmit = async () => {
    if (!libForm.name || !libForm.calories || !libForm.protein) return;
    setLibSaving(true);
    try {
      const payload = {
        name: libForm.name,
        calories: parseInt(libForm.calories),
        protein: parseFloat(libForm.protein),
        carbs: libForm.carbs ? parseFloat(libForm.carbs) : null,
        fat: libForm.fat ? parseFloat(libForm.fat) : null,
        fiber: libForm.fiber ? parseFloat(libForm.fiber) : null,
        serving_size: libForm.servingSize || null,
        category: libForm.category || "Other",
      };
      if (editItem) {
        await updateFoodLibraryItem(editItem.id, payload);
        toast({ title: "Library item updated ✓" });
      } else {
        await addFoodLibraryItem(payload);
        toast({ title: "Added to library ✓" });
      }
      await loadLibrary();
      setLibForm(EMPTY_LIB_FORM);
      setEditItem(null);
    } catch (e: any) {
      toast({ title: "Failed to save", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setLibSaving(false);
    }
  };

  const handleDeleteLib = async (id: string) => {
    try {
      await deleteFoodLibraryItem(id);
      await loadLibrary();
      toast({ title: "Removed from library" });
    } catch (e: any) {
      toast({ title: "Failed to delete", description: e?.message ?? "Unknown error", variant: "destructive" });
    }
  };

  const startEdit = (item: FoodLibraryItem) => {
    setEditItem(item);
    setLibForm({ name: item.name, calories: String(item.calories), protein: String(item.protein), carbs: String(item.carbs ?? ""), fat: String(item.fat ?? ""), fiber: String(item.fiber ?? ""), servingSize: item.serving_size ?? "", category: item.category ?? "" });
  };

  const changeDate = (dir: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + dir);
    setDate(format(d, "yyyy-MM-dd"));
  };

  const handleBarcodeDetected = async (barcode: string) => {
    setScannerOpen(false);
    setBarcodeLoading(true);
    setBarcodeError(null);
    setLogOpen(true);
    try {
      // v0 API has broader nutriment field coverage than v2
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`,
        {
          headers: { "User-Agent": "FitTrack/1.0 (github.com/astordahl3-cmd/FitTrack)" },
          signal: AbortSignal.timeout(8000),
        }
      );
      const json = await res.json();

      if (json.status !== 1 || !json.product) {
        setBarcodeError("Product not found in database — fill in manually below.");
        setBarcodeLoading(false);
        return;
      }

      const p = json.product;
      const n = p.nutriments ?? {};

      // Helper: pick first truthy numeric value from a list of field names
      const pick = (...keys: string[]): number => {
        for (const k of keys) {
          const v = parseFloat(String(n[k] ?? ""));
          if (!isNaN(v) && v > 0) return v;
        }
        return 0;
      };

      // Calories: prefer kcal per serving → kcal per 100g → convert kJ
      // Sanity cap: >2000 kcal/serving almost always means bad OFF data — skip to kJ fallback
      const kcal = (() => {
        const fromKcal = pick(
          "energy-kcal_serving", "energy-kcal_100g", "energy-kcal"
        );
        if (fromKcal > 0 && fromKcal <= 2000) return fromKcal;
        // Fall back: derive from kJ (÷ 4.184), also cap at 2000
        const kjServing = pick("energy-kj_serving", "energy_serving");
        if (kjServing > 0) return Math.min(Math.round(kjServing / 4.184), 2000);
        const kj100g = pick("energy-kj_100g", "energy_100g");
        return kj100g > 0 ? Math.min(Math.round(kj100g / 4.184), 2000) : 0;
      })();

      const protein = pick("proteins_serving", "proteins_100g", "proteins");
      const carbs   = pick("carbohydrates_serving", "carbohydrates_100g", "carbohydrates");
      const fat     = pick("fat_serving", "fat_100g", "fat");
      const fiber   = pick("fiber_serving", "fiber_100g", "fiber");

      const parsedName = p.product_name || p.abbreviated_product_name || "Unknown Product";
      const parsedFiber = Math.round(fiber * 10) / 10;

      // Store as base for serving multiplier
      const base = {
        calories: String(Math.round(kcal)),
        protein:  String(Math.round(protein * 10) / 10),
        carbs:    String(Math.round(carbs * 10) / 10),
        fat:      String(Math.round(fat * 10) / 10),
        fiber:    parsedFiber > 0 ? String(parsedFiber) : "",
      };
      setBaseForm(base);
      setServingQty("1");
      setServingUnit("");
      setForm(f => ({ ...f, name: parsedName, ...base }));

      // Store raw data so the flag button can build a pre-filled GitHub issue
      setLastScanRaw({
        barcode,
        productName: parsedName,
        rawNutriments: n,
        parsedKcal: Math.round(kcal),
        parsedProtein: Math.round(protein * 10) / 10,
        parsedCarbs: Math.round(carbs * 10) / 10,
        parsedFat: Math.round(fat * 10) / 10,
      });
    } catch (e: any) {
      if (e?.name === "TimeoutError" || e?.name === "AbortError") {
        setBarcodeError("Request timed out — check your connection and try again.");
      } else {
        setBarcodeError("Could not reach food database — check your connection.");
      }
    }
    setBarcodeLoading(false);
  };

  const SUPABASE_URL = "https://katpbbmhprximuxyjicf.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthdHBiYm1ocHJ4aW11eHlqaWNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3Mjk2MDUsImV4cCI6MjA5MjMwNTYwNX0.IFJJhMWpEnK14mP8KU8I1CiLBOS0QWq99oPIoBwg5Os";

  const handlePhotoSelected = async (file: File) => {
    setPhotoError(null);
    setPhotoResult(null);

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setPhotoAnalyzing(true);
    try {
      // Resize image to keep payload small (max 1200px, quality 0.85)
      const base64 = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1200;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl.split(',')[1]); // strip data:image/jpeg;base64,
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });

      const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-food-photo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON}`,
          'apikey': SUPABASE_ANON,
        },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
        signal: AbortSignal.timeout(35000),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        // Surface the specific OpenAI error so it's actionable
        throw new Error(err?.error ?? err?.message ?? 'Analysis failed');
      }

      const result = await res.json();
      setPhotoResult(result);

      // Pre-fill form with totals — user can review before logging
      const t = result.totals;
      const name = result.foods.length === 1
        ? result.foods[0].name
        : result.foods.map((f: any) => f.name).join(', ');
      const photoBase = {
        calories: String(Math.round(t.calories)),
        protein:  String(Math.round(t.protein * 10) / 10),
        carbs:    String(Math.round(t.carbs * 10) / 10),
        fat:      String(Math.round(t.fat * 10) / 10),
        fiber:    t.fiber ? String(Math.round(t.fiber * 10) / 10) : "",
      };
      setBaseForm(photoBase);
      setServingQty("1");
      setServingUnit("");
      setForm(f => ({ ...f, name: name || 'AI Photo Estimate', ...photoBase }));
    } catch (e: any) {
      if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
        setPhotoError('Analysis timed out — try a clearer photo or smaller portion.');
      } else {
        setPhotoError(e?.message ?? 'Could not analyze photo. Please try again.');
      }
    } finally {
      setPhotoAnalyzing(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Food Log</h1>
        <div className="flex gap-2">

          {/* Food Library */}
          <Dialog open={libraryOpen} onOpenChange={v => { setLibraryOpen(v); if (!v) { setEditItem(null); setLibForm(EMPTY_LIB_FORM); } }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><BookOpen className="h-4 w-4 mr-1.5" /> Library</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
              <DialogHeader><DialogTitle>Food Library</DialogTitle></DialogHeader>
              <Tabs defaultValue="browse" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="w-full">
                  <TabsTrigger value="browse" className="flex-1">Browse & Edit</TabsTrigger>
                  <TabsTrigger value="add" className="flex-1">{editItem ? "Edit Item" : "Add New"}</TabsTrigger>
                </TabsList>

                <TabsContent value="browse" className="flex-1 overflow-hidden flex flex-col mt-3 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search library..." value={libSearch} onChange={e => setLibSearch(e.target.value)} className="pl-8" />
                  </div>
                  {/* Category filter chips */}
                  <div className="flex gap-1.5 flex-wrap">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setLibCategory(cat)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                          libCategory === cat
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                    {filteredLibAll.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No items found</p>
                    ) : filteredLibAll.map(item => (
                      <div key={item.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/50 group transition-all">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.calories} kcal · {item.protein}g protein
                            {item.carbs != null ? ` · ${item.carbs}g carbs` : ""}
                            {item.fat != null ? ` · ${item.fat}g fat` : ""}
                            {item.serving_size ? ` · ${item.serving_size}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-2 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => startEdit(item)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteLib(item.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">{filteredLibAll.length} of {library.length} items</p>
                </TabsContent>

                <TabsContent value="add" className="mt-3 space-y-3">
                  {editItem && (
                    <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2">
                      <p className="text-sm font-medium text-primary">Editing: {editItem.name}</p>
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={() => { setEditItem(null); setLibForm(EMPTY_LIB_FORM); }}>Clear</Button>
                    </div>
                  )}
                  <div>
                    <Label>Food Name *</Label>
                    <Input value={libForm.name} onChange={e => setLibForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Chicken Breast (8 oz)" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Serving Size</Label>
                      <Input value={libForm.servingSize} onChange={e => setLibForm(f => ({ ...f, servingSize: e.target.value }))} placeholder="e.g. 8 oz, 1 cup" />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Select value={libForm.category || "Other"} onValueChange={v => setLibForm(f => ({ ...f, category: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.filter(c => c !== "All").map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Calories *</Label><Input type="number" value={libForm.calories} onChange={e => setLibForm(f => ({ ...f, calories: e.target.value }))} placeholder="0" /></div>
                    <div><Label>Protein (g) *</Label><Input type="number" value={libForm.protein} onChange={e => setLibForm(f => ({ ...f, protein: e.target.value }))} placeholder="0" /></div>
                    <div><Label>Carbs (g)</Label><Input type="number" value={libForm.carbs} onChange={e => setLibForm(f => ({ ...f, carbs: e.target.value }))} placeholder="0" /></div>
                    <div><Label>Fat (g)</Label><Input type="number" value={libForm.fat} onChange={e => setLibForm(f => ({ ...f, fat: e.target.value }))} placeholder="0" /></div>
                    <div><Label>Fiber (g)</Label><Input type="number" value={libForm.fiber} onChange={e => setLibForm(f => ({ ...f, fiber: e.target.value }))} placeholder="0" /></div>
                  </div>
                  <Button onClick={handleLibSubmit} disabled={!libForm.name || !libForm.calories || !libForm.protein || libSaving} className="w-full">
                    {libSaving ? "Saving..." : editItem ? "Save Changes" : "Add to Library"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">* Required fields</p>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>

          {/* Barcode Scanner */}
          <Dialog open={scannerOpen} onOpenChange={v => { setScannerOpen(v); if (!v) setBarcodeError(null); }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><ScanBarcode className="h-4 w-4 mr-1.5" /> Scan</Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Scan Barcode</DialogTitle></DialogHeader>
              <BarcodeScanner onDetected={handleBarcodeDetected} onClose={() => setScannerOpen(false)} />
            </DialogContent>
          </Dialog>

          {/* AI Photo — hidden file input */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                setLogOpen(true);
                handlePhotoSelected(file);
              }
              e.target.value = '';
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => photoInputRef.current?.click()}
          >
            <Camera className="h-4 w-4 mr-1.5" /> AI Photo
          </Button>

          {/* Add Food */}
          <Dialog open={logOpen} onOpenChange={v => { setLogOpen(v); if (!v) { setBarcodeError(null); setLastScanRaw(null); setPhotoPreview(null); setPhotoResult(null); setPhotoError(null); setBaseForm(null); setServingQty("1"); setServingUnit(""); setForm({ meal: "Noon", name: "", calories: "", protein: "", carbs: "", fat: "", fiber: "" }); } }}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1.5" /> Add Food</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Log Food</DialogTitle></DialogHeader>
              <div className="space-y-4">
                {barcodeLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Looking up barcode...
                  </div>
                )}
                {barcodeError && (
                  <div className="text-sm text-destructive rounded-lg bg-destructive/10 px-3 py-2">
                    {barcodeError}
                  </div>
                )}

                {/* Barcode scan result */}
                {lastScanRaw && !barcodeLoading && (
                  <div className="rounded-lg border border-border px-3 py-2.5 space-y-2 bg-muted/20">
                    <p className="text-xs font-semibold text-foreground truncate">{lastScanRaw.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {lastScanRaw.parsedKcal} kcal · {lastScanRaw.parsedProtein}g P · {lastScanRaw.parsedCarbs}g C · {lastScanRaw.parsedFat}g F
                    </p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <Button
                        className="flex-1"
                        size="sm"
                        onClick={handleLogSubmit}
                        disabled={logSaving || !form.name || !form.calories || !form.protein}
                      >
                        {logSaving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</> : "Log This Food"}
                      </Button>
                      <p className="text-xs text-muted-foreground/70 flex-1">
                        Or adjust values below
                      </p>
                    </div>
                  </div>
                )}

                {/* AI Photo analysis */}
                {(photoAnalyzing || photoPreview || photoError) && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    {/* Preview strip */}
                    {photoPreview && (
                      <div className="relative bg-black">
                        <img
                          src={photoPreview}
                          alt="Food photo"
                          className="w-full max-h-40 object-contain"
                        />
                        <button
                          onClick={() => { setPhotoPreview(null); setPhotoResult(null); setPhotoError(null); }}
                          className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Analyzing spinner */}
                    {photoAnalyzing && (
                      <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground bg-muted/30">
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                        <span>Analyzing with GPT-4o Vision…</span>
                      </div>
                    )}

                    {/* Error */}
                    {photoError && (
                      <div className="flex items-start gap-2 px-3 py-2.5 text-sm text-destructive bg-destructive/10">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{photoError}</span>
                      </div>
                    )}

                    {/* Result breakdown */}
                    {photoResult && !photoAnalyzing && (
                      <div className="px-3 py-2.5 space-y-2 bg-muted/20">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground">AI Breakdown</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            photoResult.confidence === 'high'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                              : photoResult.confidence === 'medium'
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                          }`}>
                            {photoResult.confidence} confidence
                          </span>
                        </div>

                        {/* Per-food breakdown */}
                        {photoResult.foods.length > 1 && (
                          <div className="space-y-1">
                            {photoResult.foods.map((food, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground truncate flex-1 min-w-0 mr-2">
                                  {food.name}{food.portion ? ` (${food.portion})` : ''}
                                </span>
                                <span className="shrink-0 tabular-nums">
                                  {food.calories} kcal
                                </span>
                              </div>
                            ))}
                            <div className="border-t border-border pt-1 flex items-center justify-between text-xs font-semibold">
                              <span>Total</span>
                              <span>{photoResult.totals.calories} kcal · {photoResult.totals.protein}g P · {photoResult.totals.carbs}g C · {photoResult.totals.fat}g F</span>
                            </div>
                          </div>
                        )}

                        {photoResult.foods.length === 1 && (
                          <p className="text-xs text-muted-foreground">
                            {photoResult.foods[0].name}{photoResult.foods[0].portion ? ` · ${photoResult.foods[0].portion}` : ''}
                            {' · '}{photoResult.totals.calories} kcal · {photoResult.totals.protein}g P · {photoResult.totals.carbs}g C · {photoResult.totals.fat}g F
                          </p>
                        )}

                        {photoResult.notes && (
                          <p className="text-xs text-muted-foreground italic border-t border-border pt-1.5">
                            {photoResult.notes}
                          </p>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            className="flex-1"
                            size="sm"
                            onClick={handleLogSubmit}
                            disabled={logSaving || !form.name || !form.calories || !form.protein}
                          >
                            {logSaving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Saving…</> : "Log This Food"}
                          </Button>
                          <p className="text-xs text-muted-foreground/70 flex-1">
                            Or adjust values below
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search your food library..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
                  {search && filteredLibrary.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredLibrary.map(item => (
                        <button key={item.id} className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between" onClick={() => fillFromLibrary(item)}>
                          <span>{item.name}</span>
                          <span className="text-xs text-muted-foreground ml-2 shrink-0">{item.calories} kcal · {item.protein}g prot</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {search && filteredLibrary.length === 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-sm px-3 py-2 text-xs text-muted-foreground">
                      No matches — fill in manually below
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Meal Time</Label>
                    <Select value={form.meal} onValueChange={v => setForm(f => ({ ...f, meal: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MEAL_TIMES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Food Name</Label>
                    <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Chicken Breast" />
                  </div>
                </div>

                {/* Serving size row — shown when a library item or barcode pre-filled the form */}
                {baseForm && (
                  <div className="rounded-lg bg-muted/40 border border-border px-3 py-2.5 space-y-2">
                    <Label className="text-xs text-muted-foreground">Serving size</Label>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {["0.25", "0.5", "0.75", "1", "1.5", "2"].map(q => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => { setServingQty(q); applyServing(q, baseForm); }}
                            className={`px-2 py-1 text-xs rounded border transition-colors ${
                              servingQty === q
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-border hover:bg-muted"
                            }`}
                          >
                            {q === "0.25" ? "¼" : q === "0.5" ? "½" : q === "0.75" ? "¾" : q}
                          </button>
                        ))}
                      </div>
                      <Input
                        type="number"
                        min="0.1"
                        step="0.25"
                        value={servingQty}
                        onChange={e => { setServingQty(e.target.value); applyServing(e.target.value, baseForm); }}
                        className="w-16 h-7 text-xs text-center"
                      />
                      {servingUnit && (
                        <span className="text-xs text-muted-foreground truncate">{servingUnit}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {form.calories} kcal · {form.protein}g P · {form.carbs || 0}g C · {form.fat || 0}g F{form.fiber ? ` · ${form.fiber}g fiber` : ""}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Calories</Label><Input type="number" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} placeholder="0" /></div>
                  <div><Label>Protein (g)</Label><Input type="number" value={form.protein} onChange={e => setForm(f => ({ ...f, protein: e.target.value }))} placeholder="0" /></div>
                  <div><Label>Carbs (g)</Label><Input type="number" value={form.carbs} onChange={e => setForm(f => ({ ...f, carbs: e.target.value }))} placeholder="0" /></div>
                  <div><Label>Fat (g)</Label><Input type="number" value={form.fat} onChange={e => setForm(f => ({ ...f, fat: e.target.value }))} placeholder="0" /></div>
                  <div><Label>Fiber (g)</Label><Input type="number" value={form.fiber} onChange={e => setForm(f => ({ ...f, fiber: e.target.value }))} placeholder="0" /></div>
                </div>

                <Button onClick={handleLogSubmit} disabled={logSaving} className="w-full">
                  {logSaving ? "Saving..." : "Log Food"}
                </Button>

                {/* Flag bad data — only shown after a barcode scan */}
                {lastScanRaw && (
                  <div className="rounded-lg border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/30 px-3 py-2.5">
                    <p className="text-xs text-yellow-800 dark:text-yellow-300 font-medium mb-1.5">
                      Scanned from Open Food Facts · Does the data look wrong?
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-yellow-800 dark:text-yellow-300 border-yellow-400 dark:border-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 text-xs h-8"
                      onClick={() => {
                        const r = lastScanRaw;
                        const n = r.rawNutriments;
                        // Build the raw API fields JSON block matching the template schema
                        const rawJson = JSON.stringify({
                          'energy-kcal_serving': n['energy-kcal_serving'] ?? null,
                          'energy-kcal_100g':    n['energy-kcal_100g']    ?? null,
                          'energy_serving':      n['energy_serving']      ?? null,
                          'energy_100g':         n['energy_100g']         ?? null,
                          'proteins_serving':    n['proteins_serving']    ?? null,
                          'carbohydrates_serving': n['carbohydrates_serving'] ?? null,
                          'fat_serving':         n['fat_serving']         ?? null,
                          'serving_size':        n['serving_size']        ?? '',
                        }, null, 2);
                        // Detect whether the 2000 kcal sanity cap fired
                        const rawKcal = parseFloat(String(n['energy-kcal_serving'] ?? n['energy-kcal_100g'] ?? 0));
                        const capFired = rawKcal > 2000;
                        const body = [
                          `## Product Information`,
                          ``,
                          `| Field | Value |`,
                          `|-------|-------|`,
                          `| **Product Name** | ${r.productName} |`,
                          `| **Barcode** | ${r.barcode} |`,
                          `| **Open Food Facts Link** | https://world.openfoodfacts.org/product/${r.barcode} |`,
                          ``,
                          `---`,
                          ``,
                          `## Parsed Macro Values (what FitTrack displayed)`,
                          ``,
                          `| Nutrient | Value |`,
                          `|----------|-------|`,
                          `| Calories | ${r.parsedKcal} kcal |`,
                          `| Protein | ${r.parsedProtein}g |`,
                          `| Carbs | ${r.parsedCarbs}g |`,
                          `| Fat | ${r.parsedFat}g |`,
                          ``,
                          `---`,
                          ``,
                          `## What's Wrong`,
                          ``,
                          `<!-- Describe the problem clearly. Examples:`,
                          `  - Calories are unrealistically high (e.g. 16,500 kcal for a single serving)`,
                          `  - Macros don't add up to reported calories`,
                          `  - All zeroes despite product clearly having nutrition info`,
                          `-->`,
                          ``,
                          `---`,
                          ``,
                          `## Raw API Fields (from Open Food Facts response)`,
                          ``,
                          `\`\`\`json`,
                          rawJson,
                          `\`\`\``,
                          ``,
                          `---`,
                          ``,
                          `## Sanity Check Triggered?`,
                          ``,
                          capFired
                            ? `- [x] Yes — the 2,000 kcal safety cap was applied (raw value was ${rawKcal} kcal)`
                            : `- [ ] Yes — the 2,000 kcal safety cap was applied (raw value exceeded limit)`,
                          capFired
                            ? `- [ ] No — data passed through as-is`
                            : `- [x] No — data passed through as-is`,
                          ``,
                          `---`,
                          ``,
                          `## Expected Values`,
                          ``,
                          `<!-- Check product packaging or USDA FoodData Central for correct values -->`,
                          ``,
                          `| Nutrient | Expected Value | Source |`,
                          `|----------|---------------|--------|`,
                          `| Calories | | |`,
                          `| Protein | | |`,
                          `| Carbs | | |`,
                          `| Fat | | |`,
                        ].join('\n');
                        const url = `https://github.com/astordahl3-cmd/FitTrack/issues/new` +
                          `?template=bad_data_report.md` +
                          `&labels=bad-data` +
                          `&title=${encodeURIComponent(`[BAD DATA] ${r.productName} (${r.barcode})`)}` +
                          `&body=${encodeURIComponent(body)}`;
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      <Flag className="h-3 w-3 mr-1.5" />
                      Flag bad data on GitHub
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Date nav */}
      <div className="flex items-center justify-between bg-card border border-border rounded-lg px-3 py-2">
        <Button variant="ghost" size="icon" onClick={() => changeDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-sm font-medium">
          {date === format(new Date(), "yyyy-MM-dd") ? "Today" : format(new Date(date + "T12:00:00"), "EEE, MMM d")}
        </span>
        <Button variant="ghost" size="icon" onClick={() => changeDate(1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {/* Daily totals */}
      <div className="grid grid-cols-3 gap-3">
        <Card className={totals.cal > CALORIE_TARGET ? "border-red-300 dark:border-red-800" : "border-primary/20"}>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold stat-value">{totals.cal}</p>
            <p className="text-xs text-muted-foreground">/ {CALORIE_TARGET} kcal</p>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full transition-all ${totals.cal > CALORIE_TARGET ? "bg-red-500" : "bg-blue-500"}`}
                style={{ width: `${Math.min(totals.cal / CALORIE_TARGET * 100, 100)}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card className={totals.prot >= PROTEIN_TARGET ? "border-primary" : "border-border"}>
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold stat-value text-primary">{Math.round(totals.prot)}g</p>
            <p className="text-xs text-muted-foreground">/ {PROTEIN_TARGET}g protein</p>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(totals.prot / PROTEIN_TARGET * 100, 100)}%` }} />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-bold stat-value text-emerald-600 dark:text-emerald-400">{Math.round(totals.fiber * 10) / 10}g</p>
            <p className="text-xs text-muted-foreground">fiber today</p>
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(totals.fiber / 25 * 100, 100)}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Meal groups */}
      {Object.keys(mealGroups).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <div className="text-4xl mb-3 opacity-30">🍽</div>
            <p className="text-sm font-medium">No meals logged yet</p>
            <p className="text-xs mt-1">Tap "Add Food" to log your first meal</p>
          </CardContent>
        </Card>
      ) : (
        MEAL_TIMES.filter(m => mealGroups[m]).map(meal => (
          <Card key={meal}>
            <CardHeader className="pb-1 pt-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">{meal}</CardTitle>
                <span className="text-xs text-muted-foreground stat-value">
                  {mealGroups[meal].reduce((a, e) => a + e.calories, 0)} kcal
                  {" · "}
                  {mealGroups[meal].reduce((a, e) => a + e.protein, 0).toFixed(0)}g protein
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3 space-y-2">
              {mealGroups[meal].map(entry => (
                <div key={entry.id} className="flex items-center justify-between py-1 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.name}</p>
                    <p className="text-xs text-muted-foreground stat-value">
                      {entry.protein}g prot
                      {entry.carbs != null ? ` · ${entry.carbs}g carb` : ""}
                      {entry.fat != null ? ` · ${entry.fat}g fat` : ""}
                      {entry.fiber != null && entry.fiber > 0 ? ` · ${entry.fiber}g fiber` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="text-sm font-semibold stat-value">{entry.calories}</span>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                      onClick={() => handleDeleteFood(entry.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
