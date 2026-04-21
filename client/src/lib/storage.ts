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
  serving_size?: string | null;
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
  const { data: row, error } = await supabase
    .from("weight_entries")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
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
  const { data: row, error } = await supabase
    .from("food_entries")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
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
  const { data: row, error } = await supabase
    .from("workout_sessions")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
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
  const { data: row, error } = await supabase
    .from("food_library")
    .insert({ ...data, serving_size: data.serving_size ?? null })
    .select()
    .single();
  if (error) throw error;
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

// ── Daily Summary ─────────────────────────────────────────────────────────────

export async function getDailySummary(date: string) {
  const [foodEntries, workouts, weightData] = await Promise.all([
    getFoodByDate(date),
    getWorkoutsByDate(date),
    getWeightEntries(1),
  ]);

  const weight = weightData.find(w => w.date === date) ?? null;
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
