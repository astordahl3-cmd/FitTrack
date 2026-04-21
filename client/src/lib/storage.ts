/**
 * FitTrack local storage layer.
 * All data persists in localStorage — works fully offline, no server needed.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface WeightEntry {
  id: number;
  date: string;
  weight: number;
  note?: string | null;
  createdAt: string;
}

export interface FoodEntry {
  id: number;
  date: string;
  meal: string;
  name: string;
  calories: number;
  protein: number;
  carbs?: number | null;
  fat?: number | null;
  createdAt: string;
}

export interface WorkoutSession {
  id: number;
  date: string;
  type: string;
  name: string;
  duration?: number | null;
  notes?: string | null;
  exercises?: any;
  createdAt: string;
}

export interface FoodLibraryItem {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs?: number | null;
  fat?: number | null;
  servingSize?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function nextId(items: { id: number }[]): number {
  return items.length === 0 ? 1 : Math.max(...items.map(i => i.id)) + 1;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Keys ───────────────────────────────────────────────────────────────────

const KEYS = {
  weight: "fittrack:weight",
  food: "fittrack:food",
  workouts: "fittrack:workouts",
  library: "fittrack:library",
  seeded: "fittrack:seeded",
};

// ── Default food library ───────────────────────────────────────────────────

const DEFAULT_LIBRARY: Omit<FoodLibraryItem, "id">[] = [
  { name: "Whey Protein Shake (2 scoops)", calories: 240, protein: 50, carbs: 6, fat: 3, servingSize: "2 scoops" },
  { name: "Banana", calories: 105, protein: 1, carbs: 27, fat: 0, servingSize: "1 medium" },
  { name: "Chicken Breast (8 oz)", calories: 330, protein: 62, carbs: 0, fat: 7, servingSize: "8 oz" },
  { name: "Ground Beef 95% (8 oz)", calories: 310, protein: 49, carbs: 0, fat: 12, servingSize: "8 oz" },
  { name: "Salmon (8 oz)", calories: 370, protein: 50, carbs: 0, fat: 18, servingSize: "8 oz" },
  { name: "Whole Eggs (2)", calories: 140, protein: 12, carbs: 1, fat: 10, servingSize: "2 eggs" },
  { name: "Egg Whites (4)", calories: 68, protein: 14, carbs: 1, fat: 0, servingSize: "4 whites" },
  { name: "Greek Yogurt (1 cup)", calories: 130, protein: 22, carbs: 9, fat: 0, servingSize: "1 cup" },
  { name: "Cottage Cheese (1.5 cups)", calories: 220, protein: 38, carbs: 8, fat: 3, servingSize: "1.5 cups" },
  { name: "Ground Turkey (8 oz)", calories: 280, protein: 44, carbs: 0, fat: 10, servingSize: "8 oz" },
  { name: "Shrimp (8 oz)", calories: 240, protein: 46, carbs: 3, fat: 4, servingSize: "8 oz" },
  { name: "Broccoli (2 cups)", calories: 60, protein: 5, carbs: 12, fat: 1, servingSize: "2 cups" },
  { name: "Mixed Berries (1 cup)", calories: 85, protein: 1, carbs: 21, fat: 0, servingSize: "1 cup" },
  { name: "Apple", calories: 95, protein: 0, carbs: 25, fat: 0, servingSize: "1 medium" },
  { name: "Chicken Thighs (8 oz)", calories: 380, protein: 48, carbs: 0, fat: 20, servingSize: "8 oz" },
  { name: "Pork Tenderloin (8 oz)", calories: 280, protein: 48, carbs: 0, fat: 8, servingSize: "8 oz" },
  { name: "Steak Lean Cut (8 oz)", calories: 350, protein: 52, carbs: 0, fat: 14, servingSize: "8 oz" },
];

function ensureSeeded() {
  if (localStorage.getItem(KEYS.seeded)) return;
  const library: FoodLibraryItem[] = DEFAULT_LIBRARY.map((item, i) => ({ ...item, id: i + 1 }));
  save(KEYS.library, library);
  localStorage.setItem(KEYS.seeded, "1");
}

// ── Weight ──────────────────────────────────────────────────────────────────

export function getWeightEntries(limit = 90): WeightEntry[] {
  const all = load<WeightEntry[]>(KEYS.weight, []);
  return all.slice(-limit).reverse();
}

export function addWeight(data: { date: string; weight: number; note?: string | null }): WeightEntry {
  const all = load<WeightEntry[]>(KEYS.weight, []);
  const entry: WeightEntry = { ...data, id: nextId(all), createdAt: new Date().toISOString() };
  save(KEYS.weight, [...all, entry]);
  return entry;
}

export function deleteWeight(id: number): void {
  const all = load<WeightEntry[]>(KEYS.weight, []);
  save(KEYS.weight, all.filter(e => e.id !== id));
}

// ── Food ────────────────────────────────────────────────────────────────────

export function getFoodByDate(date: string): FoodEntry[] {
  const all = load<FoodEntry[]>(KEYS.food, []);
  return all.filter(e => e.date === date);
}

export function addFood(data: Omit<FoodEntry, "id" | "createdAt">): FoodEntry {
  const all = load<FoodEntry[]>(KEYS.food, []);
  const entry: FoodEntry = { ...data, id: nextId(all), createdAt: new Date().toISOString() };
  save(KEYS.food, [...all, entry]);
  return entry;
}

export function deleteFood(id: number): void {
  const all = load<FoodEntry[]>(KEYS.food, []);
  save(KEYS.food, all.filter(e => e.id !== id));
}

// ── Workouts ─────────────────────────────────────────────────────────────────

export function getWorkoutsByDate(date: string): WorkoutSession[] {
  const all = load<WorkoutSession[]>(KEYS.workouts, []);
  return all.filter(w => w.date === date);
}

export function getRecentWorkouts(limit = 30): WorkoutSession[] {
  const all = load<WorkoutSession[]>(KEYS.workouts, []);
  return all.slice(-limit).reverse();
}

export function addWorkout(data: Omit<WorkoutSession, "id" | "createdAt">): WorkoutSession {
  const all = load<WorkoutSession[]>(KEYS.workouts, []);
  const session: WorkoutSession = { ...data, id: nextId(all), createdAt: new Date().toISOString() };
  save(KEYS.workouts, [...all, session]);
  return session;
}

export function deleteWorkout(id: number): void {
  const all = load<WorkoutSession[]>(KEYS.workouts, []);
  save(KEYS.workouts, all.filter(w => w.id !== id));
}

// ── Food Library ──────────────────────────────────────────────────────────────

export function getFoodLibrary(): FoodLibraryItem[] {
  ensureSeeded();
  return load<FoodLibraryItem[]>(KEYS.library, []);
}

export function addFoodLibraryItem(data: Omit<FoodLibraryItem, "id">): FoodLibraryItem {
  const all = getFoodLibrary();
  const item: FoodLibraryItem = { ...data, id: nextId(all) };
  save(KEYS.library, [...all, item]);
  return item;
}

export function updateFoodLibraryItem(id: number, data: Partial<Omit<FoodLibraryItem, "id">>): FoodLibraryItem {
  const all = getFoodLibrary();
  const updated = all.map(item => item.id === id ? { ...item, ...data } : item);
  save(KEYS.library, updated);
  return updated.find(i => i.id === id)!;
}

export function deleteFoodLibraryItem(id: number): void {
  const all = getFoodLibrary();
  save(KEYS.library, all.filter(i => i.id !== id));
}

// ── Daily Summary ─────────────────────────────────────────────────────────────

export function getDailySummary(date: string) {
  const foodEntries = getFoodByDate(date);
  const workouts = getWorkoutsByDate(date);
  const weightAll = load<WeightEntry[]>(KEYS.weight, []);
  const weight = weightAll.find(w => w.date === date) ?? null;

  const totals = foodEntries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + (e.carbs ?? 0),
      fat: acc.fat + (e.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return { ...totals, foodEntries, workouts, weight };
}
