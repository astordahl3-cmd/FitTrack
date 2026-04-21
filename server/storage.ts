import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc, gte, lte } from "drizzle-orm";
import {
  weightEntries, foodEntries, workoutSessions, foodLibrary,
  WeightEntry, InsertWeight, FoodEntry, InsertFood,
  WorkoutSession, InsertWorkout, FoodLibraryItem, InsertFoodLibrary,
} from "@shared/schema";

const sqlite = new Database("fittrack.db");
const db = drizzle(sqlite);

// Initialize tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS weight_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    weight REAL NOT NULL,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS food_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    meal TEXT NOT NULL,
    name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    protein REAL NOT NULL,
    carbs REAL,
    fat REAL,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS workout_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    duration INTEGER NOT NULL,
    calories_burned INTEGER,
    exercises TEXT NOT NULL DEFAULT '[]',
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS food_library (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    protein REAL NOT NULL,
    carbs REAL,
    fat REAL,
    serving_size TEXT
  );
`);

// Seed default food library items
const existingItems = db.select().from(foodLibrary).all();
if (existingItems.length === 0) {
  const defaults = [
    { name: "Whey Protein Shake (2 scoops)", calories: 240, protein: 50, carbs: 6, fat: 4, servingSize: "2 scoops" },
    { name: "Banana", calories: 105, protein: 1.3, carbs: 27, fat: 0.4, servingSize: "1 medium" },
    { name: "Chicken Breast (8 oz)", calories: 370, protein: 69, carbs: 0, fat: 8, servingSize: "8 oz" },
    { name: "Ground Beef 95% (8 oz)", calories: 310, protein: 54, carbs: 0, fat: 10, servingSize: "8 oz" },
    { name: "Salmon (8 oz)", calories: 470, protein: 63, carbs: 0, fat: 22, servingSize: "8 oz" },
    { name: "Whole Eggs (2)", calories: 144, protein: 12.6, carbs: 1.4, fat: 9.6, servingSize: "2 eggs" },
    { name: "Egg Whites (4)", calories: 68, protein: 14, carbs: 1, fat: 0.4, servingSize: "4 whites" },
    { name: "Greek Yogurt (1 cup)", calories: 130, protein: 22, carbs: 9, fat: 0.7, servingSize: "1 cup" },
    { name: "Cottage Cheese (1.5 cups)", calories: 222, protein: 30, carbs: 8, fat: 5, servingSize: "1.5 cups" },
    { name: "Ground Turkey (8 oz)", calories: 280, protein: 52, carbs: 0, fat: 7, servingSize: "8 oz" },
    { name: "Shrimp (8 oz)", calories: 224, protein: 43, carbs: 2, fat: 3, servingSize: "8 oz" },
    { name: "Broccoli (2 cups)", calories: 62, protein: 5, carbs: 12, fat: 0.6, servingSize: "2 cups" },
    { name: "Mixed Berries (1 cup)", calories: 70, protein: 1, carbs: 17, fat: 0.5, servingSize: "1 cup" },
    { name: "Apple", calories: 95, protein: 0.5, carbs: 25, fat: 0.3, servingSize: "1 medium" },
    { name: "Chicken Thighs (8 oz)", calories: 420, protein: 56, carbs: 0, fat: 20, servingSize: "8 oz" },
    { name: "Pork Tenderloin (8 oz)", calories: 290, protein: 56, carbs: 0, fat: 7, servingSize: "8 oz" },
    { name: "Steak Lean Cut (8 oz)", calories: 400, protein: 60, carbs: 0, fat: 16, servingSize: "8 oz" },
  ];
  for (const item of defaults) {
    db.insert(foodLibrary).values(item).run();
  }
}

export interface IStorage {
  // Weight
  getWeightEntries(limit?: number): WeightEntry[];
  getWeightByDate(date: string): WeightEntry | undefined;
  addWeight(data: InsertWeight): WeightEntry;
  deleteWeight(id: number): void;

  // Food
  getFoodByDate(date: string): FoodEntry[];
  addFood(data: InsertFood): FoodEntry;
  deleteFood(id: number): void;

  // Workouts
  getWorkoutsByDate(date: string): WorkoutSession[];
  getRecentWorkouts(limit?: number): WorkoutSession[];
  addWorkout(data: InsertWorkout): WorkoutSession;
  deleteWorkout(id: number): void;

  // Food Library
  getFoodLibrary(): FoodLibraryItem[];
  addFoodLibraryItem(data: InsertFoodLibrary): FoodLibraryItem;
  updateFoodLibraryItem(id: number, data: Partial<InsertFoodLibrary>): FoodLibraryItem;
  deleteFoodLibraryItem(id: number): void;

  // Dashboard summary
  getDailySummary(date: string): {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    foodEntries: FoodEntry[];
    workouts: WorkoutSession[];
    weight: WeightEntry | undefined;
  };
}

export const storage: IStorage = {
  getWeightEntries(limit = 90) {
    return db.select().from(weightEntries).orderBy(desc(weightEntries.date)).limit(limit).all();
  },

  getWeightByDate(date: string) {
    return db.select().from(weightEntries).where(eq(weightEntries.date, date)).get();
  },

  addWeight(data: InsertWeight) {
    return db.insert(weightEntries).values(data).returning().get();
  },

  deleteWeight(id: number) {
    db.delete(weightEntries).where(eq(weightEntries.id, id)).run();
  },

  getFoodByDate(date: string) {
    return db.select().from(foodEntries).where(eq(foodEntries.date, date)).all();
  },

  addFood(data: InsertFood) {
    return db.insert(foodEntries).values(data).returning().get();
  },

  deleteFood(id: number) {
    db.delete(foodEntries).where(eq(foodEntries.id, id)).run();
  },

  getWorkoutsByDate(date: string) {
    return db.select().from(workoutSessions).where(eq(workoutSessions.date, date)).all();
  },

  getRecentWorkouts(limit = 30) {
    return db.select().from(workoutSessions).orderBy(desc(workoutSessions.date)).limit(limit).all();
  },

  addWorkout(data: InsertWorkout) {
    return db.insert(workoutSessions).values(data).returning().get();
  },

  deleteWorkout(id: number) {
    db.delete(workoutSessions).where(eq(workoutSessions.id, id)).run();
  },

  getFoodLibrary() {
    return db.select().from(foodLibrary).all();
  },

  addFoodLibraryItem(data: InsertFoodLibrary) {
    return db.insert(foodLibrary).values(data).returning().get();
  },

  updateFoodLibraryItem(id: number, data: Partial<InsertFoodLibrary>) {
    return db.update(foodLibrary).set(data).where(eq(foodLibrary.id, id)).returning().get();
  },

  deleteFoodLibraryItem(id: number) {
    db.delete(foodLibrary).where(eq(foodLibrary.id, id)).run();
  },

  getDailySummary(date: string) {
    const entries = db.select().from(foodEntries).where(eq(foodEntries.date, date)).all();
    const workouts = db.select().from(workoutSessions).where(eq(workoutSessions.date, date)).all();
    const weight = db.select().from(weightEntries).where(eq(weightEntries.date, date)).get();

    const totals = entries.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.protein,
        carbs: acc.carbs + (e.carbs ?? 0),
        fat: acc.fat + (e.fat ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return { ...totals, foodEntries: entries, workouts, weight };
  },
};
