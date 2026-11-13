/* Rating, processing, natural-state, and ingredient lists.
   Uses only numbers and fields present in the Open Food Facts product.
   Missing fields stay "Not listed". */
(function (global) {
  "use strict";

  const NOVA = {
    1: {
      title: "Unprocessed or minimally processed",
      short: "Closest to its natural state",
      text: "These are plants, animal foods, eggs, milk, water, or foods changed only by drying, grinding, freezing, boiling, pasteurizing, or similar steps, without adding salt, sugar, oils, or fats."
    },
    2: {
      title: "Processed culinary ingredients",
      short: "A cooking ingredient, not a whole meal",
      text: "Oils, butter, sugar, salt, and starches made from group 1 foods. They are used in cooking, not usually eaten as the main food on their own."
    },
    3: {
      title: "Processed foods",
      short: "A real food with salt, sugar, or oil added",
      text: "Group 1 foods with salt, sugar, oil, or other group 2 ingredients added, such as canned vegetables, fruit in syrup, cheeses, and freshly made breads."
    },
    4: {
      title: "Ultra-processed",
      short: "An industrial product, far from a whole food",
      text: "Industrial products made mostly from substances extracted or derived from foods, plus additives that create taste, color, or texture. Many sodas, packaged snacks, instant noodles, and reconstituted meats are in this group."
    }
  };

  const NUTRI_SCORE_PTS = { a: 100, b: 80, c: 55, d: 30, e: 10 };
  const NOVA_PTS = { 1: 100, 2: 70, 3: 40, 4: 10 };
  const LEVEL_PTS = { low: 100, moderate: 50, high: 0 };
  const LEVEL_WORDS = { low: "low", moderate: "moderate", high: "high" };

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function isNum(v) { return typeof v === "number" && isFinite(v); }
  function letterFor(score) {
    if (score == null) return null;
    if (score >= 85) return { letter: "A", label: "Excellent", color: "#15803d" };
    if (score >= 70) return { letter: "B", label: "Good", color: "#65a30d" };
    if (score >= 55) return { letter: "C", label: "Fair", color: "#ca8a04" };
    if (score >= 40) return { letter: "D", label: "Poor", color: "#ea580c" };
    return { letter: "F", label: "Low", color: "#dc2626" };
  }

  function nutriGrade(p) {
    const g = String(p.nutriscore_grade || p.nutrition_grade_fr || p.nutrition_grades || "").toLowerCase().trim();
    if ("abcde".indexOf(g) >= 0) return g;
    return null;
  }

  function novaGroup(p) {
    const n = Number(p.nova_group || p.nova_groups);
    return (n >= 1 && n <= 4) ? n : null;
  }

  function additivesList(p) {
    const tags = Array.isArray(p.additives_tags) ? p.additives_tags.slice() : [];
    const n = isNum(p.additives_n) ? p.additives_n : (tags.length || null);
    return { tags: tags, n: n };
  }

  /* Sodium in Open Food Facts is stored in grams. Display in milligrams. */
  function grams(nutriments, key) {
    if (!nutriments) return null;
    const v = nutriments[key];
    return isNum(v) ? v : null;
  }

  function sodiumMg(nutriments, per) {
    const suffix = per === "serving" ? "_serving" : "_100g";
    const na = grams(nutriments, "sodium" + suffix);
    if (isNum(na)) return na * 1000;
    const salt = grams(nutriments, "salt" + suffix);
    if (isNum(salt)) return (salt / 2.5) * 1000; // salt ≈ 2.5 × sodium
    return null;
  }

  function textQuality(t) {
    let s = 0;
    if (!t.ocr) s += 50;
    const lang = String(t.lang || "").replace(/_.*$/, "").slice(0, 2);
    const pref = { en: 45, fr: 36, es: 32, it: 28, de: 26, pt: 26, nl: 20, pl: 12 };
    s += pref[lang] || 0;
    if (t.key === "ingredients_text_en" || t.key === "ingredients_text") s += 22;
    if (t.key === "ingredients_text_fr") s += 8;
    const low = t.text.toLowerCase();
    if (/haltbar|aufbewahrung|trocken lagern|mindestens haltbar|vielseitig verwendbar|siehe verpackung|www\.|https?:|kann spuren von|unbenannt|best before/.test(low)) s -= 55;
    if (lang === "en" && (t.text.match(/,/g) || []).length >= 3) s += 40;
    const commas = (t.text.match(/,/g) || []).length;
    s += Math.min(commas, 10) * 4;
    s += Math.min(t.text.length, 240) / 8;
    if (t.text.length >= 15 && t.text.length <= 500) s += 10;
    if (t.text.length > 800) s -= 25;
    // Official English is sometimes just the first two ingredients
    if (commas <= 1 && t.text.length < 40) s -= 80;
    if (/_result$/i.test(t.key) && lang === "en") s += 15;
    // scripts we cannot rate well lose points when a Latin-script list exists
    if (/[\u0400-\u04FF\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF]/.test(t.text) && commas < 2) s -= 30;
    return s;
  }

  function pickIngredientsText(product) {
    const texts = [];
    Object.keys(product || {}).forEach(function (k) {
      if (!/^ingredients_text($|_)/.test(k)) return;
      if (/allergen|debug|processed|hierarchy|analysis|tags|with_allergens/i.test(k)) return;
      const v = product[k];
      if (typeof v === "string" && v.trim().length > 1) {
        const lang = k.replace(/^ingredients_text_?/, "") || (product.lang || "en");
        texts.push({ key: k, lang: lang, text: v.trim(), ocr: /_ocr_/i.test(k) });
      }
    });
    texts.sort(function (a, b) { return textQuality(b) - textQuality(a) || b.text.length - a.text.length; });
    return texts[0] || null;
  }

  function splitRunOn(text) {
    const phrases = [
      "high fructose corn syrup", "carbonated water", "sparkling water",
      "caramel color", "caramel colour", "phosphoric acid", "citric acid",
      "sodium benzoate", "sodium bicarbonate", "natural flavorings", "natural flavourings",
      "natural flavors", "natural flavours", "natural flavor", "natural flavour",
      "soy lecithin", "soya lecithin", "calcium carbonate", "ascorbic acid",
      "folic acid", "reduced iron", "niacinamide", "thiamine mononitrate",
      "yellow 5", "yellow 6", "red 40", "blue 1", "partly skimmed milk",
      "skim milk powder", "palm oil", "vegetable oil", "canola oil", "caffeine"
    ].sort(function (a, b) { return b.length - a.length; });
    return text.split(",").map(function (chunk) {
      const words = chunk.trim().split(/\s+/);
      if (words.length < 4) return chunk;
      let t = " " + chunk.trim() + " ";
      phrases.forEach(function (p) {
        const re = new RegExp("\\s(" + p.replace(/\s+/g, "\\s+") + ")\\s", "ig");
        t = t.replace(re, ", $1, ");
      });
      return t.replace(/^[\s,]+|[\s,]+$/g, "");
    }).join(", ");
  }

  function cleanPart(s) {
    return String(s || "")
      .replace(/_/g, "")
      .replace(/\*/g, "")
      .replace(/^\s*(ingredients?|ingredienti|ingredientes|zutaten|ingr[eé]dients?)\s*:\s*/i, "")
      .replace(/^\s*\d+(\s*[,.]\s*\d+)?\s*%\s*/, "")
      .replace(/\s*\d+(\s*[,.]\s*\d+)?\s*%/g, "")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/[\[\]()]/g, " ")
      .replace(/caffeine content:.*$/i, "")
      .replace(/^[A-Za-zÀ-ÿ'’\s-]{3,24}:\s*/i, "")
      .replace(/^[\s.,;:]+|[\s.,;:]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isJunkIngredient(s) {
    const t = String(s || "").toLowerCase();
    if (t.length < 2) return true;
    if (/^(and|et|and\/or|or|ou)$/i.test(t)) return true;
    if (/may contain|kann spuren|traces of|trace of|organic farming|from organic|ingredient from|haltbar|aufbewahrung|lagern|siehe |www\.|http|packaging|verpackung|mindestens|vielseitig|trocken|address|gmbh|inc\.|ltd|spuren von/.test(t)) return true;
    if (t.length > 90) return true;
    if (/^\d+\s*(mg|g|ml|cl|oz|fl\.?\s*oz)\b/.test(t)) return true;
    if (/^(mg|g|ml|fl\.?\s*oz)\b/.test(t)) return true;
    return false;
  }

  function splitIngredientText(text) {
    if (!text) return [];
    let t = text.replace(/\s+/g, " ").trim();
    t = t.replace(/(\d+)\s*,\s*(\d+)\s*%/g, "$1.$2%"); // 7,4% or 7, 4% -> 7.4%
    t = t.replace(/\b(colour|color|colouring|coloring|acid|acidifier|emulsifier|emulsifiers|emulsifiant|emulsifiants|stabiliser|stabilizer|preservative|sweetener|flavouring|flavoring|arome)\s*\(([^)]+)\)/ig, "$2");
    t = t.replace(/\b(sans gluten|gluten[- ]free)\b/ig, " ");
    t = t.replace(/\b(may contain traces of.*|kann spuren von.*)$/ig, " ");
    t = splitRunOn(t);
    t = t.replace(/[;•·|/]+/g, ",");
    t = t.replace(/\.(?=\s+[A-ZÀ-Ü])/g, ",");
    const parts = t.split(",").map(cleanPart).filter(function (s) { return !isJunkIngredient(s); });
    return parts;
  }

  function structuredIngredients(product) {
    const arr = Array.isArray(product.ingredients) ? product.ingredients : [];
    return arr.map(function (ing) {
      if (!ing) return null;
      const text = cleanPart(ing.text || String(ing.id || "").replace(/^[a-z]{2}:/, "").replace(/-/g, " "));
      if (!text || isJunkIngredient(text)) return null;
      return { text: text, id: ing.id || "" };
    }).filter(Boolean);
  }

  function ingredientEntries(product) {
    const out = [];
    const seen = Object.create(null);
    function push(text, id) {
      const label = cleanPart(text);
      if (!label || isJunkIngredient(label)) return;
      const key = (id || label).toLowerCase();
      if (seen[key] || seen[label.toLowerCase()]) return;
      seen[key] = 1;
      seen[label.toLowerCase()] = 1;
      const rec = (global.FoodScanRef && (FoodScanRef.lookup(id || "") || FoodScanRef.lookup(label)));
      out.push({
        text: label,
        id: id || "",
        rating: rec ? rec.rating : "unknown",
        reason: rec ? rec.reason : "This ingredient is not in the app's reference list.",
        name: rec ? rec.name : label,
        caution: !!(rec && rec.caution)
      });
    }

    const structured = structuredIngredients(product);
    const picked = pickIngredientsText(product);
    const fromText = picked ? splitIngredientText(picked.text) : [];
    const textLooksBetter = fromText.length >= 2 && fromText.length >= structured.length - 1;
    if (textLooksBetter && fromText.length) {
      fromText.forEach(function (x) { push(x, ""); });
    } else if (structured.length) {
      structured.forEach(function (x) { push(x.text, x.id); });
    } else {
      fromText.forEach(function (x) { push(x, ""); });
    }
    const display = (picked && picked.text) || product.ingredients_text_en || product.ingredients_text || "";
    return { items: out, sourceText: display, sourceLang: picked ? String(picked.lang || "").replace(/_.*$/, "") : "" };
  }

  function computeRating(product) {
    const parts = [];
    const g = nutriGrade(product);
    if (g) {
      parts.push({
        key: "nutriscore",
        label: "Nutri-Score",
        weight: 35,
        score: NUTRI_SCORE_PTS[g],
        detail: "Official Nutri-Score " + g.toUpperCase() + " (A is most favorable, E is least)"
      });
    }
    const nova = novaGroup(product);
    if (nova) {
      parts.push({
        key: "nova",
        label: "Processing (NOVA)",
        weight: 30,
        score: NOVA_PTS[nova],
        detail: "NOVA group " + nova + " — " + NOVA[nova].title
      });
    }
    const add = additivesList(product);
    if (add.n != null) {
      let s = 100 - add.n * 8;
      let cautionN = 0;
      (add.tags || []).forEach(function (t) {
        if (global.FoodScanRef && FoodScanRef.isCautionTag(t)) {
          s -= 10;
          cautionN += 1;
        }
      });
      s = clamp(s, 0, 100);
      let detail = add.n === 0 ? "No additives listed" : (add.n + " additive" + (add.n === 1 ? "" : "s") + " listed");
      if (cautionN) detail += ", " + cautionN + " flagged for extra caution";
      parts.push({ key: "additives", label: "Additives", weight: 15, score: s, detail: detail });
    }
    const levels = product.nutrient_levels || {};
    const lv = [];
    ["sugars", "salt", "saturated-fat", "fat"].forEach(function (k) {
      const lvl = levels[k];
      if (lvl && LEVEL_PTS[lvl] != null) lv.push({ k: k, level: lvl, score: LEVEL_PTS[lvl] });
    });
    if (lv.length) {
      const avg = lv.reduce(function (a, b) { return a + b.score; }, 0) / lv.length;
      const detail = lv.map(function (x) {
        const name = x.k === "saturated-fat" ? "saturated fat" : x.k;
        return name + " " + x.level;
      }).join(", ");
      parts.push({ key: "nutrients", label: "Nutrient levels", weight: 20, score: avg, detail: "Open Food Facts levels: " + detail });
    }

    if (!parts.length) {
      return { score: null, letter: null, label: null, color: null, parts: parts, note: "Not enough data to rate" };
    }
    const tw = parts.reduce(function (a, p) { return a + p.weight; }, 0);
    const score = Math.round(parts.reduce(function (a, p) { return a + p.score * (p.weight / tw); }, 0));
    const L = letterFor(score);
    return { score: score, letter: L.letter, label: L.label, color: L.color, parts: parts, note: null, weightTotal: tw };
  }

  function naturalState(product, entries) {
    const nova = novaGroup(product);
    const items = (entries && entries.items) || [];
    const add = additivesList(product);
    const nAdd = add.n != null ? add.n : 0;
    let base = null;
    let how = "";
    if (nova === 1) { base = 95; how = "Started at 95 because this is NOVA group 1 (unprocessed or minimally processed)."; }
    else if (nova === 2) { base = 65; how = "Started at 65 because this is NOVA group 2 (a culinary ingredient such as oil, sugar, or salt)."; }
    else if (nova === 3) { base = 40; how = "Started at 40 because this is NOVA group 3 (a processed food)."; }
    else if (nova === 4) { base = 15; how = "Started at 15 because this is NOVA group 4 (ultra-processed)."; }

    if (base == null) {
      if (!items.length && !nAdd) {
        return { score: null, label: "Not listed", text: "Open Food Facts does not list a NOVA group or a usable ingredient list for this product.", steps: [] };
      }
      if (items.length === 1 && items[0].rating === "good" && nAdd === 0) {
        base = 90;
        how = "No NOVA group is listed. Started at 90 because only one simple, whole ingredient is listed and no additives are listed.";
      } else if (nAdd >= 3 || items.some(function (i) { return i.rating === "poor"; })) {
        base = 25;
        how = "No NOVA group is listed. Started at 25 because the ingredient list includes refined ingredients or several additives.";
      } else {
        base = 50;
        how = "No NOVA group is listed. Started at 50 from the ingredient list alone.";
      }
    }

    const steps = [{ text: how, delta: 0, score: base }];
    let score = base;
    const n = items.length;
    if (n === 1) {
      score += 5;
      steps.push({ text: "Only one ingredient is listed, so 5 points were added.", delta: 5, score: score });
    } else if (n >= 16) {
      score -= 20;
      steps.push({ text: n + " ingredients are listed, so 20 points were taken off.", delta: -20, score: score });
    } else if (n >= 9) {
      score -= 12;
      steps.push({ text: n + " ingredients are listed, so 12 points were taken off.", delta: -12, score: score });
    } else if (n >= 4) {
      score -= 5;
      steps.push({ text: n + " ingredients are listed, so 5 points were taken off.", delta: -5, score: score });
    }

    if (nAdd > 0) {
      let d = -4 * nAdd;
      let cautionN = 0;
      (add.tags || []).forEach(function (t) {
        if (global.FoodScanRef && FoodScanRef.isCautionTag(t)) { d -= 6; cautionN += 1; }
      });
      score += d;
      let msg = nAdd + " additive" + (nAdd === 1 ? " was" : "s were") + " listed, so " + (4 * nAdd) + " points were taken off (4 each).";
      if (cautionN) msg += " An extra 6 points were taken off for each of " + cautionN + " caution-flagged additive" + (cautionN === 1 ? "" : "s") + ".";
      steps.push({ text: msg, delta: d, score: score });
    }

    let poor = 0, good = 0;
    items.forEach(function (i) {
      if (i.rating === "poor") poor += 1;
      if (i.rating === "good") good += 1;
    });
    if (poor) {
      const d = -Math.min(16, poor * 4);
      score += d;
      steps.push({ text: poor + " ingredient" + (poor === 1 ? " was" : "s were") + " rated poor (for example added sugar or refined flour), so " + Math.abs(d) + " points were taken off.", delta: d, score: score });
    }
    if (good && n && good === n && nAdd === 0) {
      score += 5;
      steps.push({ text: "Every listed ingredient rated good, and no additives are listed, so 5 points were added.", delta: 5, score: score });
    }

    score = Math.round(clamp(score, 0, 100));
    let label, text;
    if (score >= 80) { label = "Close to its natural state"; text = "This looks like a whole or barely changed food."; }
    else if (score >= 55) { label = "Partly changed from its original form"; text = "Some processing or refining has taken it away from a whole food."; }
    else if (score >= 30) { label = "Quite far from its natural state"; text = "This has been processed or refined well beyond a simple whole food."; }
    else { label = "Far from its natural state"; text = "This looks like an industrial or heavily refined product."; }

    return { score: score, label: label, text: text, steps: steps, nova: nova };
  }

  function unusualNutrient(product) {
    const n = product.nutriments || {};
    const flags = [];
    const cats = String(product.categories_tags || product.categories || "").toLowerCase();
    const drink = /beverage|drink|soda|soft-drink|carbonated|eaux|boisson/.test(cats) || /ml|fl oz/i.test(String(product.serving_size || product.quantity || ""));
    function nice(v) {
      const a = Math.abs(v);
      const d = a >= 10 ? 1 : a >= 1 ? 2 : 3;
      return Number(v.toFixed(d)).toString();
    }
    ["fat_100g", "saturated-fat_100g", "carbohydrates_100g", "sugars_100g", "fiber_100g", "proteins_100g", "salt_100g"].forEach(function (k) {
      if (isNum(n[k]) && n[k] > 100.5) flags.push(k.replace("_100g", "") + " is listed as " + nice(n[k]) + " g per 100 g, which is over 100 g and cannot be right.");
    });
    if (isNum(n.sodium_100g) && n.sodium_100g > 40) flags.push("sodium is listed as " + nice(n.sodium_100g) + " g per 100 g, which is higher than pure salt.");
    if (drink && isNum(n.salt_100g) && n.salt_100g > 1.5) flags.push("salt is listed as " + nice(n.salt_100g) + " g per 100 g in a drink, which is unusually high and may be a data error.");
    return flags;
  }

  function highlights(product, entries, rating, natural) {
    const good = [];
    const bad = [];
    const n = product.nutriments || {};
    const levels = product.nutrient_levels || {};
    const nova = novaGroup(product);

    function g100(key) { return isNum(n[key]) ? n[key] : null; }
    const fiber = g100("fiber_100g") ?? g100("fibre_100g");
    const protein = g100("proteins_100g");
    const sugars = g100("sugars_100g");
    const sat = g100("saturated-fat_100g");
    const fat = g100("fat_100g");
    const salt = g100("salt_100g");

    if (fiber != null && fiber >= 6) good.push({ title: "High fiber", text: fiber + " g of fiber per 100 g. In European labeling, 6 g or more per 100 g may be called high fiber." });
    else if (fiber != null && fiber >= 3) good.push({ title: "A source of fiber", text: fiber + " g of fiber per 100 g. In European labeling, 3 g or more per 100 g may be called a source of fiber." });

    if (protein != null && protein >= 20) good.push({ title: "High protein", text: protein + " g of protein per 100 g." });
    else if (protein != null && protein >= 10) good.push({ title: "A useful amount of protein", text: protein + " g of protein per 100 g." });

    if (levels.sugars === "low") good.push({ title: "Low sugar", text: sugars != null ? ("Open Food Facts marks sugars as low (" + sugars + " g per 100 g).") : "Open Food Facts marks sugars as low." });
    if (levels.salt === "low") good.push({ title: "Low salt", text: salt != null ? ("Open Food Facts marks salt as low (" + salt + " g per 100 g).") : "Open Food Facts marks salt as low." });
    if (levels["saturated-fat"] === "low") good.push({ title: "Low saturated fat", text: sat != null ? ("Open Food Facts marks saturated fat as low (" + sat + " g per 100 g).") : "Open Food Facts marks saturated fat as low." });

    if (nova === 1) good.push({ title: "Minimally processed", text: "NOVA group 1: this is in the group closest to a food's natural state." });

    const items = (entries && entries.items) || [];
    const goodIngs = items.filter(function (i) { return i.rating === "good"; });
    if (goodIngs.length) {
      const names = goodIngs.slice(0, 8).map(function (i) { return i.text; }).join(", ");
      good.push({ title: "Whole or simple ingredients", text: "These listed ingredients rate as good: " + names + (goodIngs.length > 8 ? "…" : "") + "." });
    }

    if (levels.sugars === "high") bad.push({ title: "High sugar", text: sugars != null ? ("Open Food Facts marks sugars as high (" + sugars + " g per 100 g).") : "Open Food Facts marks sugars as high." });
    if (levels.salt === "high") bad.push({ title: "High salt / sodium", text: salt != null ? ("Open Food Facts marks salt as high (" + salt + " g per 100 g). Extra sodium matters if you are watching blood pressure.") : "Open Food Facts marks salt as high." });
    if (levels["saturated-fat"] === "high") bad.push({ title: "High saturated fat", text: sat != null ? ("Open Food Facts marks saturated fat as high (" + sat + " g per 100 g).") : "Open Food Facts marks saturated fat as high." });
    if (levels.fat === "high" && levels["saturated-fat"] !== "high") bad.push({ title: "High fat", text: fat != null ? ("Open Food Facts marks fat as high (" + fat + " g per 100 g).") : "Open Food Facts marks fat as high." });

    if (nova === 4) bad.push({ title: "Ultra-processed", text: "NOVA group 4: this is in the most processed group, typically far from a whole food." });
    else if (nova === 3) bad.push({ title: "Processed food", text: "NOVA group 3: a real food with salt, sugar, or oil added." });

    const poorIngs = items.filter(function (i) { return i.rating === "poor"; });
    poorIngs.forEach(function (i) {
      bad.push({ title: i.text, text: i.reason + (i.caution ? " This one is flagged for extra caution." : "") });
    });

    const add = additivesList(product);
    (add.tags || []).forEach(function (t) {
      const rec = global.FoodScanRef && FoodScanRef.lookup(t);
      if (rec && rec.caution) {
        bad.push({ title: rec.name, text: rec.reason });
      }
    });

    // de-dupe by title
    function uniq(list) {
      const seen = Object.create(null);
      return list.filter(function (x) {
        const k = x.title.toLowerCase();
        if (seen[k]) return false;
        seen[k] = 1;
        return true;
      });
    }
    return { good: uniq(good), bad: uniq(bad) };
  }

  function fmtG(v, digits) {
    if (!isNum(v)) return "Not listed";
    const d = digits != null ? digits : (Math.abs(v) >= 10 ? 1 : (Math.abs(v) >= 1 ? 2 : 3));
    const n = Number(v).toFixed(d).replace(/\.?0+$/, "");
    return n + " g";
  }

  function fmtMg(v) {
    if (!isNum(v)) return "Not listed";
    if (v >= 10) return Math.round(v) + " mg";
    if (v >= 1) return v.toFixed(1).replace(/\.0$/, "") + " mg";
    return v.toFixed(2) + " mg";
  }

  function nutritionRows(product) {
    const n = product.nutriments || {};
    function pair(keys) {
      for (let i = 0; i < keys.length; i++) {
        if (isNum(n[keys[i]])) return n[keys[i]];
      }
      return null;
    }
    const rows = [
      { label: "Energy", per100: isNum(n["energy-kcal_100g"]) ? (Math.round(n["energy-kcal_100g"]) + " kcal") : (isNum(n.energy_100g) ? (Math.round(n.energy_100g) + " kJ") : "Not listed"),
        serving: isNum(n["energy-kcal_serving"]) ? (Math.round(n["energy-kcal_serving"]) + " kcal") : "Not listed" },
      { label: "Fat", per100: fmtG(pair(["fat_100g"])), serving: fmtG(pair(["fat_serving"])) },
      { label: "Saturated fat", per100: fmtG(pair(["saturated-fat_100g"])), serving: fmtG(pair(["saturated-fat_serving"])) },
      { label: "Carbohydrates", per100: fmtG(pair(["carbohydrates_100g"])), serving: fmtG(pair(["carbohydrates_serving"])) },
      { label: "Sugars", per100: fmtG(pair(["sugars_100g"])), serving: fmtG(pair(["sugars_serving"])) },
      { label: "Fiber", per100: fmtG(pair(["fiber_100g", "fibre_100g"])), serving: fmtG(pair(["fiber_serving", "fibre_serving"])) },
      { label: "Protein", per100: fmtG(pair(["proteins_100g"])), serving: fmtG(pair(["proteins_serving"])) },
      { label: "Salt", per100: fmtG(pair(["salt_100g"])), serving: fmtG(pair(["salt_serving"])) },
      { label: "Sodium", per100: fmtMg(sodiumMg(n, "100g")), serving: fmtMg(sodiumMg(n, "serving")) }
    ];
    return rows;
  }

  function sodiumInfo(product) {
    const n = product.nutriments || {};
    const per100 = sodiumMg(n, "100g");
    const perServing = sodiumMg(n, "serving");
    const serving = product.serving_size || null;
    const level = (product.nutrient_levels || {}).salt || null;
    const unusual = unusualNutrient(product);
    function pct(mg, daily) {
      if (!isNum(mg)) return null;
      return Math.round((mg / daily) * 1000) / 10; // one decimal
    }
    const high = level === "high" || (isNum(per100) && per100 >= 600) || (isNum(perServing) && perServing >= 400);
    const moderate = !high && (level === "moderate" || (isNum(per100) && per100 >= 300) || (isNum(perServing) && perServing >= 200));
    return {
      per100: per100,
      perServing: perServing,
      serving: serving,
      level: level,
      high: high,
      moderate: moderate,
      pct1500_100: pct(per100, 1500),
      pct2300_100: pct(per100, 2300),
      pct1500_s: pct(perServing, 1500),
      pct2300_s: pct(perServing, 2300),
      unusual: unusual,
      listed: isNum(per100) || isNum(perServing)
    };
  }

  global.FoodScanRate = {
    NOVA: NOVA,
    nutriGrade: nutriGrade,
    novaGroup: novaGroup,
    additivesList: additivesList,
    computeRating: computeRating,
    naturalState: naturalState,
    ingredientEntries: ingredientEntries,
    pickIngredientsText: pickIngredientsText,
    highlights: highlights,
    nutritionRows: nutritionRows,
    sodiumInfo: sodiumInfo,
    unusualNutrient: unusualNutrient,
    letterFor: letterFor,
    fmtG: fmtG,
    fmtMg: fmtMg,
    isNum: isNum,
    sodiumMg: sodiumMg
  };
})(window);
