import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertWeightSchema, insertFoodSchema, insertWorkoutSchema, insertFoodLibrarySchema } from "@shared/schema";
import https from "https";

export async function registerRoutes(httpServer: Server, app: Express) {

  // ── Dashboard ──────────────────────────────────────────────────────────────
  app.get("/api/summary/:date", (req, res) => {
    try {
      const summary = storage.getDailySummary(req.params.date);
      res.json(summary);
    } catch (e) {
      res.status(500).json({ error: "Failed to get summary" });
    }
  });

  // ── Weight ─────────────────────────────────────────────────────────────────
  app.get("/api/weight", (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 90;
    res.json(storage.getWeightEntries(limit));
  });

  app.post("/api/weight", (req, res) => {
    const parsed = insertWeightSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const entry = storage.addWeight(parsed.data);
    res.status(201).json(entry);
  });

  app.delete("/api/weight/:id", (req, res) => {
    storage.deleteWeight(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ── Food ───────────────────────────────────────────────────────────────────
  app.get("/api/food/:date", (req, res) => {
    res.json(storage.getFoodByDate(req.params.date));
  });

  app.post("/api/food", (req, res) => {
    const parsed = insertFoodSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const entry = storage.addFood(parsed.data);
    res.status(201).json(entry);
  });

  app.delete("/api/food/:id", (req, res) => {
    storage.deleteFood(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ── Workouts ───────────────────────────────────────────────────────────────
  app.get("/api/workouts", (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
    res.json(storage.getRecentWorkouts(limit));
  });

  app.get("/api/workouts/:date", (req, res) => {
    res.json(storage.getWorkoutsByDate(req.params.date));
  });

  app.post("/api/workouts", (req, res) => {
    const parsed = insertWorkoutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const session = storage.addWorkout(parsed.data);
    res.status(201).json(session);
  });

  app.delete("/api/workouts/:id", (req, res) => {
    storage.deleteWorkout(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ── Food Library ───────────────────────────────────────────────────────────
  app.get("/api/food-library", (req, res) => {
    res.json(storage.getFoodLibrary());
  });

  app.post("/api/food-library", (req, res) => {
    const parsed = insertFoodLibrarySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const item = storage.addFoodLibraryItem(parsed.data);
    res.status(201).json(item);
  });

  app.patch("/api/food-library/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const { name, servingSize, calories, protein, carbs, fat } = req.body;
    const item = storage.updateFoodLibraryItem(id, { name, servingSize, calories, protein, carbs, fat });
    res.json(item);
  });

  app.delete("/api/food-library/:id", (req, res) => {
    storage.deleteFoodLibraryItem(parseInt(req.params.id));
    res.json({ success: true });
  });

  // ── Barcode Lookup (Open Food Facts proxy) ─────────────────────────────────
  app.get("/api/barcode/:code", (req, res) => {
    const code = encodeURIComponent(req.params.code);
    const url = `https://world.openfoodfacts.org/api/v2/product/${code}?fields=product_name,serving_size,nutriments`;

    https.get(url, { headers: { "User-Agent": "FitTrack/1.0" } }, (upstream) => {
      let body = "";
      upstream.on("data", (chunk) => { body += chunk; });
      upstream.on("end", () => {
        try {
          const json = JSON.parse(body);
          if (json.status !== 1 || !json.product) {
            return res.status(404).json({ error: "Product not found" });
          }
          const p = json.product;
          const n = p.nutriments ?? {};
          // OFF nutriments are per 100g — we return serving values when available
          const per100 = (key: string) => parseFloat(n[key] ?? n[`${key}_100g`] ?? 0) || 0;
          res.json({
            name: p.product_name ?? "Unknown Product",
            servingSize: p.serving_size ?? "100g",
            calories: Math.round(per100("energy-kcal")),
            protein: Math.round(per100("proteins") * 10) / 10,
            carbs: Math.round(per100("carbohydrates") * 10) / 10,
            fat: Math.round(per100("fat") * 10) / 10,
          });
        } catch {
          res.status(500).json({ error: "Failed to parse product data" });
        }
      });
    }).on("error", () => {
      res.status(502).json({ error: "Could not reach Open Food Facts" });
    });
  });

}
