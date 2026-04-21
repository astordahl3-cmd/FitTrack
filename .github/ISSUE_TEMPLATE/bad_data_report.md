---
name: Bad Data Report (Open Food Facts)
about: Flag a product with incorrect or suspicious nutrition data from the Open Food Facts API
title: "[BAD DATA] "
labels: bad-data, open-food-facts
assignees: ''
---

## Product Information

| Field | Value |
|-------|-------|
| **Product Name** | <!-- e.g. Chobani Plain Greek Yogurt --> |
| **Barcode** | <!-- e.g. 012345678901 --> |
| **Open Food Facts Link** | <!-- e.g. https://world.openfoodfacts.org/product/012345678901 --> |

---

## Parsed Macro Values (what FitTrack displayed)

| Nutrient | Value |
|----------|-------|
| Calories | <!-- e.g. 16,500 kcal --> |
| Protein | <!-- e.g. 17g --> |
| Carbs | <!-- e.g. 6g --> |
| Fat | <!-- e.g. 0g --> |

---

## What's Wrong

<!-- Describe the problem clearly. Examples:
  - Calories are unrealistically high (e.g. 16,500 kcal for a single serving of yogurt)
  - Macros don't add up to reported calories
  - Serving size appears to be for the entire package, not a single serving
  - Protein/carb/fat values are swapped or obviously wrong
  - All zeroes despite product clearly having nutrition info
-->

---

## Raw API Fields (from Open Food Facts response)

```json
{
  "energy-kcal_serving": ,
  "energy-kcal_100g": ,
  "energy_serving": ,
  "energy_100g": ,
  "proteins_serving": ,
  "carbohydrates_serving": ,
  "fat_serving": ,
  "serving_size": ""
}
```

---

## Sanity Check Triggered?

- [ ] Yes — the 2,000 kcal safety cap was applied (raw value exceeded limit)
- [ ] No — data passed through as-is

---

## Expected Values

<!-- What should the correct values be? Check the product packaging or a trusted source like the USDA FoodData Central. -->

| Nutrient | Expected Value | Source |
|----------|---------------|--------|
| Calories | | <!-- e.g. 90 kcal per 3/4 cup --> |
| Protein | | |
| Carbs | | |
| Fat | | |

---

## Acceptance Criteria

- [ ] OFF product page updated with correct values (submit correction at link above)
- [ ] FitTrack correctly parses the product after OFF data is fixed
- [ ] If a structural parsing bug exists in FitTrack, it is fixed independently of the OFF data

---

## Additional Notes

<!-- Any other context, screenshots, or related issue numbers -->
