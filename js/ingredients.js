/* Built-in reference list for common ingredients and additives.
   Ratings are good / moderate / poor. Unknown items are left as "Not rated".
   Reasons are plain-English descriptions, not medical advice. */
(function (global) {
  "use strict";

  function norm(s) {
    return String(s || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[_/]+/g, " ")
      .replace(/[^a-z0-9%+ ]+/g, " ")
      .replace(/\b(organic|bio|fresh|raw|dried|unsweetened|pure|natural)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const REF = Object.create(null);

  function add(rating, reason, names) {
    const rec = { name: names[0], rating: rating, reason: reason };
    for (let i = 0; i < names.length; i++) {
      const n = norm(names[i]);
      if (n) REF[n] = rec;
    }
  }

  /* ---------- Whole / minimally processed foods (good) ---------- */
  add("good", "A whole fruit. Close to its natural state, with fiber and no added sugar when eaten as listed.",
    ["apple", "apples", "banana", "bananas", "orange", "oranges", "lemon", "lemons", "lime", "limes", "grape", "grapes", "strawberry", "strawberries", "blueberry", "blueberries", "raspberry", "raspberries", "blackberry", "blackberries", "cherry", "cherries", "peach", "peaches", "pear", "pears", "pineapple", "mango", "mangoes", "kiwi", "watermelon", "cantaloupe", "melon", "avocado", "avocados", "plum", "plums", "apricot", "apricots", "fig", "figs", "date", "dates", "raisin", "raisins", "cranberry", "cranberries", "pomegranate", "coconut", "tomato", "tomatoes", "pomme", "banane", "fraise", "raisin"]);
  add("good", "A vegetable. Close to its natural state when it is not fried or packed in a creamy sauce.",
    ["carrot", "carrots", "broccoli", "spinach", "kale", "lettuce", "cabbage", "onion", "onions", "garlic", "pepper", "peppers", "bell pepper", "cucumber", "celery", "zucchini", "squash", "pumpkin", "potato", "potatoes", "sweet potato", "yam", "corn", "sweetcorn", "peas", "green peas", "green bean", "green beans", "mushroom", "mushrooms", "beet", "beets", "beetroot", "cauliflower", "asparagus", "eggplant", "aubergine", "leek", "leeks", "shallot", "ginger", "turmeric", "chili", "chilli", "jalapeno", "carotte", "oignon", "ail", "tomate", "pomme de terre", "epinard"]);
  add("good", "A whole grain or a minimally processed grain food. The grain is still close to its original form.",
    ["oats", "rolled oats", "whole oats", "oat flakes", "oatmeal", "whole oatmeal", "whole grain oats", "jumbo oats", "steel cut oats", "oat", "avoine", "flocons d avoine", "flocons davoine", "hafervollkornflocken", "haferflocken", "hafer", "avena", "copos de avena", "wholegrain oat flakes", "whole grain oat flakes", "oat flake", "whole wheat", "whole wheat flour", "wholemeal flour", "whole grain wheat", "whole grain flour", "farine complete", "brown rice", "wild rice", "quinoa", "barley", "whole barley", "buckwheat", "millet", "sorghum", "rye", "whole rye", "whole corn", "popcorn", "bulgur", "farro", "spelt", "teff", "amaranth", "whole grain corn", "corn masa", "oat flour", "oat bran", "wheat bran", "wheat germ"]);
  add("good", "A legume (bean, pea, or lentil). A natural protein and fiber food when it is not deep-fried.",
    ["lentils", "lentil", "chickpeas", "chickpea", "garbanzo", "black beans", "kidney beans", "pinto beans", "navy beans", "white beans", "soybeans", "edamame", "split peas", "black eyed peas", "hummus", "beans", "haricots", "lentilles", "pois chiches"]);
  add("good", "A nut or seed. A whole food that is high in unsaturated fat and generally minimally processed when plain.",
    ["almonds", "almond", "walnuts", "walnut", "cashews", "cashew", "peanuts", "peanut", "hazelnuts", "hazelnut", "noisettes", "noisette", "pecans", "pecan", "pistachios", "pistachio", "macadamia", "brazil nuts", "pine nuts", "chia seeds", "chia", "flax seeds", "flaxseed", "linseed", "pumpkin seeds", "sunflower seeds", "sesame seeds", "sesame", "hemp seeds", "tahini"]);
  add("good", "A minimally processed animal or plant protein food.",
    ["carbonated water", "sparkling water", "agua carbonatada", "eau gazeuse", "eau gazee", "eggs", "egg", "whole egg", "egg white", "egg whites", "chicken", "turkey", "beef", "pork", "lamb", "fish", "salmon", "tuna", "cod", "sardines", "sardine", "mackerel", "anchovy", "anchovies", "shrimp", "prawns", "milk", "whole milk", "lait", "skim milk", "skimmed milk", "lait ecreme", "lait ecreme en poudre", "fat free milk", "low fat milk", "2% milk", "yogurt", "plain yogurt", "greek yogurt", "yoghurt", "kefir", "cottage cheese", "tofu", "tempeh", "water", "eau", "carbonated water", "sparkling water", "eau gazeifiee", "eau carbonatee"]);
  add("good", "An herb or spice used in small amounts to flavor food, without adding sugar or fat.",
    ["salt" /* overridden below */, "black pepper", "pepper", "cinnamon", "cumin", "paprika", "oregano", "basil", "thyme", "rosemary", "parsley", "cilantro", "coriander", "dill", "mint", "sage", "nutmeg", "clove", "cloves", "cardamom", "bay leaf", "vanilla", "vanilla extract", "cocoa", "cocoa powder", "fat reduced cocoa", "cacao maigre", "cacao", "unsweetened cocoa", "coffee", "tea"]);
  add("good", "Water, including sparkling or carbonated water, with nothing else added.",
    ["water", "eau", "carbonated water", "sparkling water", "eau gazeifiee", "eau carbonatee", "eau gazeuse", "eau gazee", "agua carbonatada", "agua"]);
  // salt should not be "good"
  add("moderate", "Table salt. Needed in small amounts, but extra sodium raises blood pressure in many people.",
    ["salt", "sea salt", "kosher salt", "iodized salt", "sel", "sel marin", "sodium chloride"]);
  add("good", "A fat that is close to its original plant source and is mostly unsaturated.",
    ["extra virgin olive oil", "virgin olive oil", "olive oil", "huile d olive", "huile d olive vierge", "avocado oil"]);
  add("good", "A nutrient naturally present or added as a vitamin or mineral. Not a flavor additive.",
    ["ascorbic acid", "vitamin c", "vitamine c", "tocopherol", "tocopherols", "vitamin e", "riboflavin", "thiamin", "thiamine", "niacin", "folic acid", "folate", "vitamin a", "vitamin d", "vitamin b12", "pyridoxine", "cyanocobalamin", "calcium carbonate", "ferrous sulfate", "zinc oxide", "potassium chloride", "magnesium", "iron", "calcium"]);

  /* ---------- Culinary / mixed (moderate) ---------- */
  add("moderate", "A refined cooking oil. Useful in the kitchen, but it is extracted and no longer a whole food.",
    ["canola oil", "rapeseed oil", "sunflower oil", "huile de tournesol", "safflower oil", "soybean oil", "soya oil", "huile de soja", "corn oil", "grapeseed oil", "peanut oil", "sesame oil", "vegetable oil", "huile vegetale", "rice bran oil"]);
  add("moderate", "A dairy ingredient. Still a real food, but often concentrated or dried.",
    ["butter", "beurre", "cream", "creme", "sour cream", "cream cheese", "cheddar", "mozzarella", "parmesan", "cheese", "fromage", "whey", "whey powder", "lactoserum", "lactoserum en poudre", "milk powder", "skim milk powder", "nonfat dry milk", "lait en poudre", "buttermilk", "ghee", "lactose"]);
  add("moderate", "A nut or seed paste, or a concentrated plant ingredient. Still from a real food, but more processed than the whole food.",
    ["peanut butter", "almond butter", "hazelnut paste", "hazelnut butter", "cocoa butter", "beurre de cacao", "coconut milk", "coconut cream", "tomato paste", "tomato puree", "puree de tomate"]);
  add("moderate", "A natural sweetener. It is still a free sugar, so it is not the same as a whole fruit.",
    ["honey", "miel", "maple syrup", "molasses", "date syrup", "coconut sugar"]);
  add("moderate", "Starch taken out of a plant. Used to thicken foods; the fiber and most of the grain are gone.",
    ["corn starch", "cornstarch", "maize starch", "amidon de mais", "potato starch", "tapioca", "tapioca starch", "arrowroot", "modified starch", "modified corn starch", "modified food starch", "wheat starch"]);
  add("moderate", "A typical emulsifier or stabilizer made from plants. Used in small amounts; not a whole food.",
    ["soy lecithin", "soya lecithin", "lecithin", "lecithins", "lecithine", "lecithines", "lecithines de soja", "lecithines soja", "lecithine soja", "sunflower lecithin", "pectin", "pectine", "guar gum", "gomme guar", "xanthan gum", "locust bean gum", "carob gum", "gellan gum", "agar", "carrageenan", "carrageenan gum", "cellulose gum", "cellulose", "inulin", "acacia gum", "gum arabic"]);
  add("moderate", "A common acid or preservative used in small amounts. Generally recognized as safe, but it is an additive, not a food.",
    ["citric acid", "acide citrique", "lactic acid", "malic acid", "tartaric acid", "acetic acid", "vinegar", "vinaigre", "apple cider vinegar", "baking soda", "sodium bicarbonate", "baking powder", "monocalcium phosphate", "calcium phosphate", "potassium sorbate", "sorbic acid", "sodium citrate", "potassium citrate", "calcium chloride", "magnesium carbonate"]);
  add("moderate", "Caffeine. A stimulant that occurs in coffee and tea, and is also added to some drinks.",
    ["caffeine", "cafeine"]);
  add("moderate", "A flavoring. The exact mix is not listed, so it is hard to judge how close it is to a real food.",
    ["natural flavor", "natural flavors", "natural flavour", "natural flavouring", "natural flavourings", "aromes naturels", "arome naturel", "flavor", "flavors", "flavour", "flavouring", "flavourings", "arome", "aromes", "spices", "epices", "spice extract", "yeast extract", "autolyzed yeast extract"]);
  add("moderate", "Cocoa is a real food, but in many products it is a refined powder mixed with sugar and fat.",
    ["chocolate", "chocolat", "dark chocolate", "milk chocolate", "lean cocoa", "cacao maigre", "fat reduced cocoa", "fettarmer kakao"]);

  /* ---------- Refined / poor ---------- */
  add("poor", "Added sugar. A refined sweetener with no fiber. Health groups advise limiting added sugars.",
    ["sugar", "sucre", "azucar", "azucares", "white sugar", "cane sugar", "beet sugar", "granulated sugar", "powdered sugar", "icing sugar", "confectioners sugar", "brown sugar", "invert sugar", "invert syrup", "glucose", "glucose syrup", "sirop de glucose", "dextrose", "maltose", "maltodextrin", "maltodextrine", "fructose", "sucrose", "corn syrup", "corn syrup solids"]);
  add("poor", "High-fructose corn syrup. A refined industrial sweetener. It is an added sugar.",
    ["high fructose corn syrup", "hfcs", "glucose fructose syrup", "fructose glucose syrup", "isoglucose", "sirop de glucose fructose"]);
  add("poor", "Refined flour. The bran and germ have been removed, so most of the fiber is gone.",
    ["wheat flour", "enriched wheat flour", "enriched flour", "white flour", "bleached flour", "unbleached flour", "all purpose flour", "wheat flour enriched", "farine de ble", "farine", "refined flour", "maida"]);
  add("poor", "Palm oil. A refined fat that is high in saturated fat. It is not a whole food.",
    ["palm oil", "huile de palme", "palm kernel oil", "palme", "hydrogenated palm oil", "fractionated palm oil"]);
  add("poor", "A fat that has been hydrogenated. This process can create trans fat, which is best avoided.",
    ["hydrogenated oil", "hydrogenated vegetable oil", "partially hydrogenated oil", "partially hydrogenated soybean oil", "partially hydrogenated vegetable oil", "shortening", "vegetable shortening", "margarine"]);
  add("poor", "A refined fat that is high in saturated fat.",
    ["coconut oil", "huile de coco", "palm fat", "coconut fat"]);
  add("poor", "A processed meat or a reconstituted meat product, which is typically high in sodium and often uses curing additives.",
    ["bacon", "hot dog", "hot dogs", "sausage", "sausages", "ham", "salami", "pepperoni", "bologna", "luncheon meat", "mechanically separated chicken", "mechanically separated meat"]);
  add("poor", "A sweet syrup or confection ingredient that is mostly added sugar.",
    ["agave syrup", "agave nectar", "rice syrup", "brown rice syrup", "golden syrup", "caramel", "caramel syrup", "fondant", "icing", "frosting"]);

  add("moderate", "Vanillin is a flavoring that tastes like vanilla. It may be made from vanilla or made in a factory.",
    ["vanillin", "vanilline", "vanilla flavouring", "vanilla flavoring"]);

  /* ---------- Additives by E-number and common name ---------- */
  const ADD = Object.create(null);
  function addE(codes, name, rating, reason, caution) {
    const rec = { name: name, rating: rating, reason: reason, caution: !!caution };
    const all = codes.concat([name]);
    for (let i = 0; i < all.length; i++) {
      const n = norm(all[i]);
      if (n) {
        ADD[n] = rec;
        REF[n] = rec;
      }
    }
  }

  addE(["e100"], "Curcumin (E100)", "good", "A yellow color that comes from turmeric.", false);
  addE(["e101"], "Riboflavin (E101, vitamin B2)", "good", "A B vitamin also used as a yellow color.", false);
  addE(["e150a", "e150"], "Plain caramel color (E150a)", "moderate", "A common brown color made by heating sugars. Used in many colas and sauces.", false);
  addE(["e150c"], "Ammonia caramel (E150c)", "moderate", "A brown color used in some colas and sauces. It is an additive, not a food.", false);
  addE(["e150d"], "Sulphite ammonia caramel (E150d)", "moderate", "The usual caramel color in colas. It is an additive made from sugar, not a whole food.", false);
  addE(["e160a"], "Carotenes (E160a)", "good", "Orange color from plants, related to vitamin A.", false);
  addE(["e160b"], "Annatto (E160b)", "moderate", "A natural plant color. A few people are sensitive to it.", false);
  addE(["e160c"], "Paprika extract (E160c)", "good", "A color and flavor from peppers.", false);
  addE(["e162"], "Beetroot red (E162)", "good", "A color from beets.", false);
  addE(["e163"], "Anthocyanins (E163)", "good", "Plant colors from berries and grapes.", false);
  addE(["e170"], "Calcium carbonate (E170)", "good", "A mineral also used as a firming agent or a calcium source.", false);
  addE(["e200", "e202"], "Sorbic acid / potassium sorbate (E200, E202)", "moderate", "A common preservative that slows mold. Used in small amounts.", false);
  addE(["e211", "e210"], "Sodium benzoate (E211)", "moderate", "A preservative used in many soft drinks and sauces. Some people prefer to limit it, especially when it is mixed with vitamin C, which can form a trace of benzene.", false);
  addE(["e220", "e221", "e223", "e224"], "Sulphites (E220–E224)", "moderate", "Preservatives used in dried fruit and wine. They can trigger symptoms in people who are sensitive to sulphites.", false);
  addE(["e249", "e250"], "Sodium nitrite / potassium nitrite (E249, E250)", "poor", "Curing salts used in bacon, ham, and some sausages. They help prevent botulism, but processed meats with nitrites are a concern for long-term health. Rated with caution.", true);
  addE(["e251", "e252"], "Sodium nitrate / potassium nitrate (E251, E252)", "poor", "Curing salts used in some preserved meats. Rated with caution for the same reason as nitrites.", true);
  addE(["e300"], "Ascorbic acid (E300, vitamin C)", "good", "Vitamin C, used as an antioxidant.", false);
  addE(["e322"], "Lecithin (E322)", "moderate", "An emulsifier often made from soy or sunflower. Helps mix fat and water. Used in small amounts.", false);
  addE(["e330"], "Citric acid (E330)", "moderate", "An acid first found in citrus fruit, now often made by fermentation. Used to add tartness or preserve food.", false);
  addE(["e338"], "Phosphoric acid (E338)", "moderate", "A sharp acid used in many colas. It adds taste and is a source of phosphates. Colas with this acid also tend to be high in sugar.", false);
  addE(["e339", "e340", "e341", "e343", "e450", "e451", "e452"], "Phosphates (E339–E452)", "moderate", "Salts used to hold water in meat, or as leavening in baked goods. They add phosphorus, which some people with kidney disease must watch.", false);
  addE(["e407"], "Carrageenan (E407)", "moderate", "A thickener from red seaweed. Widely used; a few people report digestive discomfort.", false);
  addE(["e410"], "Locust bean gum (E410)", "moderate", "A thickener from carob seeds.", false);
  addE(["e412"], "Guar gum (E412)", "moderate", "A thickener from guar beans.", false);
  addE(["e415"], "Xanthan gum (E415)", "moderate", "A thickener made by fermentation.", false);
  addE(["e440"], "Pectin (E440)", "moderate", "A gelling fiber from fruit, used in jams.", false);
  addE(["e471"], "Mono- and diglycerides (E471)", "moderate", "Emulsifiers made from fats. They help mix oil and water. They are additives, not whole foods.", false);
  addE(["e472e"], "DATEM (E472e)", "moderate", "An emulsifier used in bread to make the loaf softer.", false);
  addE(["e476"], "Polyglycerol polyricinoleate (E476)", "moderate", "An emulsifier used in some chocolates to keep them smooth.", false);
  addE(["e500"], "Sodium carbonates (E500, baking soda)", "moderate", "A raising agent used in baking.", false);
  addE(["e503"], "Ammonium carbonates (E503)", "moderate", "A raising agent used in some cookies and crackers.", false);
  addE(["e621", "msg"], "Monosodium glutamate (E621, MSG)", "moderate", "A flavor enhancer that brings out a savory taste. It is generally recognized as safe. Some people report short-term sensitivity.", false);
  addE(["e627", "e631", "e635"], "Flavor-enhancing nucleotides (E627, E631, E635)", "moderate", "Savory flavor enhancers often used with MSG in snacks and noodles.", false);
  addE(["e950"], "Acesulfame K (E950)", "moderate", "A high-intensity artificial sweetener. It adds sweetness with no sugar, but it is not a whole food.", false);
  addE(["e951"], "Aspartame (E951)", "moderate", "A high-intensity artificial sweetener used in many diet drinks. It is approved by food regulators. It is not a whole food.", false);
  addE(["e952"], "Cyclamate (E952)", "moderate", "An artificial sweetener. Allowed in some countries and not in others.", false);
  addE(["e954"], "Saccharin (E954)", "moderate", "An artificial sweetener. It is not a whole food.", false);
  addE(["e955"], "Sucralose (E955)", "moderate", "A high-intensity artificial sweetener. It is not a whole food.", false);
  addE(["e960"], "Steviol glycosides (E960, stevia)", "moderate", "A high-intensity sweetener from the stevia plant. Still a processed extract, not a whole leaf.", false);
  addE(["e965"], "Maltitol (E965)", "moderate", "A sugar alcohol used in 'sugar-free' sweets. Can loosen the stool if you eat a lot of it.", false);
  addE(["e967"], "Xylitol (E967)", "moderate", "A sugar alcohol used in some gums and 'sugar-free' foods.", false);
  addE(["e968"], "Erythritol (E968)", "moderate", "A sugar alcohol used as a low-calorie sweetener.", false);

  /* Synthetic colors with an EU attention warning on labels */
  const dyeReason = "A synthetic food dye. In the European Union, foods with this dye must carry a warning that it may have an adverse effect on activity and attention in children. Rated with caution.";
  addE(["e102", "tartrazine"], "Tartrazine (E102, Yellow 5)", "poor", dyeReason, true);
  addE(["e104"], "Quinoline yellow (E104)", "poor", dyeReason, true);
  addE(["e110", "sunset yellow", "yellow 6"], "Sunset Yellow (E110, Yellow 6)", "poor", dyeReason, true);
  addE(["e122"], "Carmoisine (E122)", "poor", dyeReason, true);
  addE(["e124", "ponceau"], "Ponceau 4R (E124)", "poor", dyeReason, true);
  addE(["e129", "allura red", "red 40"], "Allura Red (E129, Red 40)", "poor", dyeReason, true);
  addE(["e133", "blue 1", "brilliant blue"], "Brilliant Blue (E133, Blue 1)", "moderate", "A synthetic blue dye. It is an additive, not a food.", false);
  addE(["e132"], "Indigo carmine (E132, Blue 2)", "moderate", "A synthetic blue dye. It is an additive, not a food.", false);

  addE(["e320", "bha"], "BHA (E320)", "poor", "Butylated hydroxyanisole, a synthetic antioxidant used to keep fats from going stale. It is classified by IARC as possibly carcinogenic to humans (Group 2B). Rated with caution.", true);
  addE(["e321", "bht"], "BHT (E321)", "poor", "Butylated hydroxytoluene, a synthetic antioxidant used in some cereals and packaged foods. Rated with caution because it is a synthetic preservative, not a food.", true);
  addE(["e319", "tbhq"], "TBHQ (E319)", "poor", "A synthetic antioxidant used to preserve fats in some packaged snacks. It is an industrial additive, not a food. Rated with caution.", true);

  /* Also map common US names already covered */
  add("moderate", "Caramel color, a brown additive used in many sodas and sauces.",
    ["caramel color", "caramel colour", "colour caramel", "color caramel", "couleur caramel"]);
  add("moderate", "Phosphoric acid, a sharp acid used in many colas.",
    ["phosphoric acid", "acide phosphorique"]);
  add("moderate", "Sodium benzoate, a common preservative in drinks and sauces.",
    ["sodium benzoate", "benzoate de sodium"]);

  function eKeyFromTag(tag) {
    const s = String(tag || "").toLowerCase();
    const m = s.match(/e\s*-?\s*(\d{3,4}[a-z]?)/i);
    return m ? ("e" + m[1].toLowerCase()) : "";
  }

  function lookup(raw) {
    if (!raw) return null;
    let s = String(raw);
    // strip OFF "en:" prefix
    s = s.replace(/^[a-z]{2}:/, "");
    const e = eKeyFromTag(s);
    if (e && ADD[e]) return ADD[e];
    const n = norm(s);
    if (!n) return null;
    if (REF[n]) return REF[n];
    if (ADD[n]) return ADD[n];
    // try without trailing "powder/oil/juice/puree"
    const n2 = n.replace(/\b(powder|concentrate|juice|puree|puree|extract|solids?|flakes?|pieces|minced|ground|chopped|sliced|flavouring|flavoring|flavourings|flavorings|complets?|complete|integral|entier|entiere)\b/g, " ").replace(/\s+/g, " ").trim();
    if (n2 && n2 !== n && REF[n2]) return REF[n2];
    // last word sometimes is the food (e.g. "roasted peanuts")
    const parts = n.split(" ");
    if (parts.length > 1) {
      const last = parts[parts.length - 1];
      if (REF[last]) return REF[last];
      const last2 = parts.slice(-2).join(" ");
      if (REF[last2]) return REF[last2];
    }
    return null;
  }

  function isCautionTag(tag) {
    const rec = lookup(tag) || (eKeyFromTag(tag) && ADD[eKeyFromTag(tag)]);
    return !!(rec && rec.caution);
  }

  global.FoodScanRef = {
    norm: norm,
    lookup: lookup,
    isCautionTag: isCautionTag,
    eKeyFromTag: eKeyFromTag,
    REF: REF,
    ADD: ADD
  };
})(window);
