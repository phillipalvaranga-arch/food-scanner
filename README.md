# Food Scanner

Installable phone app that scans a food barcode and shows how healthy the product looks, how processed or refined it is, how close it is to its natural state, the healthy and unhealthy things in it, and a rating for the product.

- **Scan** the barcode with the rear camera, type the number, or search by name.
- Product facts come from the public [Open Food Facts](https://world.openfoodfacts.org/) database. Numbers are never invented. If a field is missing, the app says "Not listed."
- The **0–100 rating** is computed in the app from Nutri-Score, the NOVA processing group, additives, and official nutrient levels. The formula is explained on the **How ratings work** page.
- **Sodium** is flagged clearly, with American Heart Association daily amounts (1,500 mg and 2,300 mg) for people watching blood pressure.
- **History** and **favorites** stay on the device only (`localStorage`). Two products can be compared side by side.

Live: https://phillipalvaranga-arch.github.io/food-scanner/

Informational only. This is not medical advice, and the app does not tell you what to eat. Talk with your doctor about what is right for you. Open Food Facts does not have every product, and some listings are incomplete or contain errors.

Camera scanning needs HTTPS (this GitHub Pages site provides that) and permission to use the camera.
