/**
 * FitTrack data layer — Supabase (cloud, multi-user) with localStorage fallback.
 * All queries are scoped to the authenticated user via Row Level Security.
 */

import { supabase } from "./supabase";

// ── Types ──────────────────────────────────────────────────────────────────

export interface WeightEntry {
  id: string;
  date: string;
  weight: number;
  note?: string | null;
  created_at: string;
}

export interface FoodEntry {
  id: string;
  date: string;
  meal: string;
  name: string;
  calories: number;
  protein: number;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
  created_at: string;
}

export interface WorkoutSession {
  id: string;
  date: string;
  type: string;
  duration?: number | null;
  calories_burned?: number | null;
  exercises?: any;
  notes?: string | null;
  created_at: string;
}

export interface FoodLibraryItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
  serving_size?: string | null;
  category?: string | null;
}

// ── Weight ──────────────────────────────────────────────────────────────────

export async function getWeightEntries(limit = 90): Promise<WeightEntry[]> {
  const { data, error } = await supabase
    .from("weight_entries")
    .select("*")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function addWeight(data: { date: string; weight: number; note?: string | null }): Promise<WeightEntry> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in — please log out and back in.");
  const { data: row, error } = await supabase
    .from("weight_entries")
    .insert({ ...data, user_id: session.user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return row;
}

export async function deleteWeight(id: string): Promise<void> {
  const { error } = await supabase.from("weight_entries").delete().eq("id", id);
  if (error) throw error;
}

// ── Food ────────────────────────────────────────────────────────────────────

export async function getFoodByDate(date: string): Promise<FoodEntry[]> {
  const { data, error } = await supabase
    .from("food_entries")
    .select("*")
    .eq("date", date)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addFood(data: Omit<FoodEntry, "id" | "created_at">): Promise<FoodEntry> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in — please log out and back in.");
  const { data: row, error } = await supabase
    .from("food_entries")
    .insert({ ...data, user_id: session.user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return row;
}

export async function updateFood(id: string, data: Partial<Omit<FoodEntry, "id" | "created_at">>): Promise<FoodEntry> {
  const { data: row, error } = await supabase
    .from("food_entries")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return row;
}

export async function deleteFood(id: string): Promise<void> {
  const { error } = await supabase.from("food_entries").delete().eq("id", id);
  if (error) throw error;
}

// ── Workouts ─────────────────────────────────────────────────────────────────

export async function getWorkoutsByDate(date: string): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("date", date)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getRecentWorkouts(limit = 30): Promise<WorkoutSession[]> {
  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function addWorkout(data: Omit<WorkoutSession, "id" | "created_at">): Promise<WorkoutSession> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in — please log out and back in.");
  const { data: row, error } = await supabase
    .from("workout_sessions")
    .insert({ ...data, user_id: session.user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return row;
}

export async function deleteWorkout(id: string): Promise<void> {
  const { error } = await supabase.from("workout_sessions").delete().eq("id", id);
  if (error) throw error;
}

// ── Food Library ──────────────────────────────────────────────────────────────

export async function getFoodLibrary(): Promise<FoodLibraryItem[]> {
  const { data, error } = await supabase
    .from("food_library")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addFoodLibraryItem(data: Omit<FoodLibraryItem, "id">): Promise<FoodLibraryItem> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not signed in — please log out and back in.");
  const { data: row, error } = await supabase
    .from("food_library")
    .insert({ ...data, serving_size: data.serving_size ?? null, user_id: session.user.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return row;
}

export async function updateFoodLibraryItem(id: string, data: Partial<Omit<FoodLibraryItem, "id">>): Promise<FoodLibraryItem> {
  const { data: row, error } = await supabase
    .from("food_library")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return row;
}

export async function deleteFoodLibraryItem(id: string): Promise<void> {
  const { error } = await supabase.from("food_library").delete().eq("id", id);
  if (error) throw error;
}

// ── User Profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  display_name?: string | null;
  start_weight?: number | null;
  goal_weight?: number | null;
  goal_date?: string | null;
  calorie_target?: number | null;
  protein_target?: number | null;
  carb_target?: number | null;
  fat_target?: number | null;
  sex?: string | null;          // 'male' | 'female'
  height_in?: number | null;   // height in inches
  age?: number | null;         // kept for legacy; prefer birthdate
  birthdate?: string | null;   // ISO date string YYYY-MM-DD
  activity_level?: string | null; // 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
  water_goal?: number | null; // daily glasses target (8 oz each), default 8
}

export async function getProfile(): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data ?? null;
}

export async function saveProfile(updates: Partial<Omit<UserProfile, "id">>): Promise<UserProfile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert({ id: user.id, ...updates })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Daily Summary ─────────────────────────────────────────────────────────────

// ── Water ───────────────────────────────────────────────────────────────────

export interface WaterLog {
  id: string;
  user_id: string;
  date: string;
  glasses: number;
  created_at: string;
}

export async function getWaterLog(date: string): Promise<number> {
  const { data, error } = await supabase
    .from('water_logs')
    .select('glasses')
    .eq('date', date)
    .maybeSingle();
  if (error) throw error;
  return data?.glasses ?? 0;
}

export async function setWaterLog(date: string, glasses: number): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  const { error } = await supabase
    .from('water_logs')
    .upsert({ user_id: session.user.id, date, glasses }, { onConflict: 'user_id,date' });
  if (error) throw new Error(error.message);
}

export async function getDailySummary(date: string) {
  const [foodEntries, workouts, weightData, water] = await Promise.all([
    getFoodByDate(date),
    getWorkoutsByDate(date),
    getWeightEntries(1),
    getWaterLog(date),
  ]);

  const weight = weightData.find(w => w.date === date) ?? null;
  const totals = foodEntries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + (e.carbs ?? 0),
      fat: acc.fat + (e.fat ?? 0),
      fiber: acc.fiber + (e.fiber ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );

  return { ...totals, foodEntries, workouts, weight, water };
}
