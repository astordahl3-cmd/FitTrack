import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Weight entries
export const weightEntries = sqliteTable("weight_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(), // ISO date string YYYY-MM-DD
  weight: real("weight").notNull(), // in lbs
  notes: text("notes"),
});

// Food log entries
export const foodEntries = sqliteTable("food_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  meal: text("meal").notNull(), // "Noon", "3 PM", "6 PM", "8 PM", "Other"
  name: text("name").notNull(),
  calories: integer("calories").notNull(),
  protein: real("protein").notNull(), // grams
  carbs: real("carbs"),
  fat: real("fat"),
  notes: text("notes"),
});

// Workout sessions
export const workoutSessions = sqliteTable("workout_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull(),
  type: text("type").notNull(), // "Upper Body", "Lower Body", "Cardio", "Custom"
  duration: integer("duration").notNull(), // minutes
  caloriesBurned: integer("calories_burned"),
  exercises: text("exercises").notNull().default("[]"), // JSON array
  notes: text("notes"),
});

// Custom food items (quick-add library)
export const foodLibrary = sqliteTable("food_library", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  calories: integer("calories").notNull(),
  protein: real("protein").notNull(),
  carbs: real("carbs"),
  fat: real("fat"),
  servingSize: text("serving_size"),
});

// Insert schemas
export const insertWeightSchema = createInsertSchema(weightEntries).omit({ id: true });
export const insertFoodSchema = createInsertSchema(foodEntries).omit({ id: true });
export const insertWorkoutSchema = createInsertSchema(workoutSessions).omit({ id: true });
export const insertFoodLibrarySchema = createInsertSchema(foodLibrary).omit({ id: true });

// Types
export type WeightEntry = typeof weightEntries.$inferSelect;
export type InsertWeight = z.infer<typeof insertWeightSchema>;

export type FoodEntry = typeof foodEntries.$inferSelect;
export type InsertFood = z.infer<typeof insertFoodSchema>;

export type WorkoutSession = typeof workoutSessions.$inferSelect;
export type InsertWorkout = z.infer<typeof insertWorkoutSchema>;

export type FoodLibraryItem = typeof foodLibrary.$inferSelect;
export type InsertFoodLibrary = z.infer<typeof insertFoodLibrarySchema>;
