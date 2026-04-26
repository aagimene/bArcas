# Kayak & small-craft design literature

Books, papers, magazines, and web resources we want to mine for theory and history. This page is a reading list with annotations.

> A few specific numerical claims in this list are from memory of the kayaking canon and should be double-checked against primary sources before being cited as fact inside the app. Where we're unsure, we mark items with (?).

---

## Books — kayak / small craft specific

### John Winters — *The Shape of the Canoe*
- Self-published / available from Green Valley Boat Works.
- The most approachable rigorous treatment of canoe/kayak hydrodynamics in print.
- Covers: hull coefficients, stability, resistance components, kayak-scale Froude numbers.
- Primary reference for our [theory/drag-and-resistance.md](../theory/drag-and-resistance.md) and [theory/hydrostatics.md](../theory/hydrostatics.md).

### Steve Killing — various articles, *WoodenBoat* columns
- Yacht designer who wrote extensively on small-craft hydrostatics/hydrodynamics.
- Good intuitive explanations of wave-making and hull speed.

### John Dowd — *Sea Kayaking: A Manual for Long-Distance Touring*
- Classic sea-kayaking manual. Chapter on kayak design gives a usable overview of how kayaks actually behave, from a paddler's perspective rather than a designer's.

### Nick Schade — *The Strip-Built Sea Kayak*
- Practical build manual from a prolific sea-kayak designer (Guillemot Kayaks).
- Useful for: station mold conventions, strip-building geometry, offset-table expectations.

### Harvey Golden — *Kayaks of Greenland*, *Kayaks of Alaska*
- Historical/ethnographic treatments of Inuit kayaks. Hundreds of hull measurements from surviving traditional kayaks.
- Primary source for reference hulls in the [Greenland / Inuit tradition](../designs/history-of-kayak-design.md).

### Howard Chapelle — *American Small Sailing Craft*, *Boatbuilding*
- Classic naval-architecture reference. Small-craft focused, pre-computer era.
- Useful for terminology and hydrostatic fundamentals.

### Francis Kinney — *Skene's Elements of Yacht Design*
- Yacht-scale rather than kayak, but the hydrostatic and stability chapters translate directly.

### Chris Cunningham — *Sea Kayaker's Savvy Paddler*
- Paddler-perspective book, editor of *Sea Kayaker* magazine. Good for understanding what design variables translate to on-the-water feel.

---

## Naval architecture textbooks

### Edward Lewis (ed.) — *Principles of Naval Architecture* (SNAME)
- The standard reference. Multiple volumes covering hydrostatics, resistance, propulsion, seakeeping, structure.
- Overkill for kayak scale but foundational.

### Volker Bertram — *Practical Ship Hydrodynamics*
- Modern reference on resistance and seakeeping. Covers Michell's integral, thin-ship theory, CFD fundamentals.

### John Carlton — *Marine Propellers and Propulsion*
- Not directly relevant to paddling but has the cleanest treatments of Reynolds number effects and frictional resistance models we cite.

### Kuiper / Harvald — classic resistance/propulsion texts
- Source for empirical resistance coefficients and friction lines (ATTC, ITTC).

---

## Academic papers / reports

### J. H. Michell (1898) — *The Wave Resistance of a Ship*
- The original thin-ship integral for wave-making resistance. Still the basis for quick-estimate resistance calculators for slender hulls.

### ITTC 1957 friction line
- The standard frictional-resistance coefficient curve used worldwide: Cf = 0.075 / (log₁₀Re − 2)².
- Our default frictional estimator.

### Holtrop & Mennen (1982, 1984) — ship resistance regressions
- Standard empirical method for ships. Not directly valid at kayak scale, but the form/waveform resistance decomposition is a useful reference.

### Lazauskas & Tuck — Michlet / kayak resistance papers
- Leo Lazauskas (Adelaide) publishes accessible papers on thin-ship resistance applied to rowing shells, kayaks, and surfskis.
- Critical reference for [theory/wave-making.md](../theory/wave-making.md).

### Savitsky (1964) — *Hydrodynamic Design of Planing Hulls*
- The standard planing-hull resistance method. Likely not needed for displacement kayaks but relevant for surfskis surfing downwind runs.

---

## Magazines and long-running columns

### *Sea Kayaker* magazine (1984 – 2014)
- Published detailed hull reviews with hydrostatic tables and stability curves for ~300+ production sea kayaks over its run.
- **Most of our reference hulls will be calibrated against Sea Kayaker measurements** where possible.
- Back issues available used / via the Sea Kayaker archive CDs.

### *Paddler*, *Canoe & Kayak*, *Ocean Paddler*
- More review-oriented, less design-oriented. Useful for paddler-feel descriptions and current-generation design trends.

### *WoodenBoat*, *Professional BoatBuilder*
- Yacht/small craft focus. Steve Killing, Robb White, and others wrote accessible design columns.

---

## Forums & web resources

### Kayak Building Bulletin Board (kayakforum.com)
- Where strip-builders and skin-on-frame builders discuss designs.
- Primary source for BearBoat community knowledge.

### West System / Guillemot Kayaks / Newfound Woodworks resources
- Builder-oriented technical notes, often with actual offset tables.

### qajaqusa.org
- Greenland-kayak community; good historical measurements.

---

## Racing rules (external references)

### ICF (International Canoe Federation)
- Rules for K1, K2, K4 sprint kayaks. Relevant for [designs/k1-sprint.md](../designs/k1-sprint.md).
- Modern rules: maximum length 5.20 m, minimum weight 12 kg. Width restriction was dropped around 2000 (to be confirmed against current ICF rulebook).

### ICF wildwater / slalom
- Different rule sets for different disciplines.

### Surfski racing bodies (ICF ocean racing, regional)
- Surfski class rules vary by organization; most are open-form with length-class distinctions.

---

## What to extract from each

As we actually read these:
1. **Formulas** → [theory/](../theory/) pages, with citation.
2. **Numbers** (hull tables from Sea Kayaker, Harvey Golden) → [designs/](../designs/) pages as reference hulls.
3. **Terminology** → [terminology/](../terminology/) pages.
4. **Rules / constraints** (ICF) → [designs/k1-sprint.md](../designs/k1-sprint.md).

---

## Related

- [bearboat-history.md](bearboat-history.md)
- [existing-hull-design-software.md](existing-hull-design-software.md)
- [../theory/README.md](../theory/README.md)
- [../designs/README.md](../designs/README.md)
