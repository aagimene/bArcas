# Michell Prototype Plan (bArcas)

## Origin & Vision
bArcas (formerly ArcasBoat) continues its evolution with the `michell` prototype. This prototype will act as an interactive "explainogram" (similar to a PowerPoint deck with interactive 3D slides) to demystify Michell's equations of wave resistance and parametric boat hull design. 

## History: From Towing Tanks to Michell

### Early Model Testing
The earliest attempts to understand ship resistance involved dragging scale model hulls across water. Engineers built giant water tanks and used steam engines to move the boats, using force measurements and counter-weights to calculate drag.

### William Froude's Swan and Raven (1867)
William Froude, a pioneering naval architect, tested two 12-foot models on the River Dart. 
- **Raven**: Designed with a sharp, fine prow, strictly following the contemporary "wave-line" theory.
- **Swan**: Designed with a fuller, blunter shape that Froude derived from observing water birds. 
*The Discovery*: The sharp *Raven* performed better at low speeds, but the blunt *Swan* demonstrated surprisingly less resistance at high speeds. This challenged prevailing theories and led to Froude establishing the mathematical basis for scaling model test results to full-size ships. We will use pictures of these wooden models and their hull diagrams.

### Michell's Equation (1898 to 2023+)
In 1898, J.H. Michell published the analytical integral for the wave resistance of a "thin ship." He provided mathematical proof that resistance could be calculated directly from the hull's shape. Research continues to this day (with significant papers up to at least 2023) utilizing Michell's theory within automated optimization frameworks and machine learning-driven hull design.

---

## Interactive "Explainogram" Slides

### Slide 1: Introduction & History
- History of model testing.
- Pictures of Froude's "Raven" and "Swan" (both the wooden models and the diagrams of their hulls).

### Slide 2: Parameterization (ELI5)
- Explain the foundational concept of $y = f(x, z)$ to a 5-year-old. This must come before any hulls or equations.
- **Gizmo**: Vector arrow gizmo with bold R, G, B colors representing the X, Y, Z directions in 3D space.
- **Visuals**: A very simple, non-boat math surface where the equation itself is color-coded to match the XYZ vectors.

### Slide 3: Defining an Underwater Boat Hull
- **Concept**: Applying $y = f(x, z)$ to make a boat hull.
- **3D Visualization**: Interactive (camera rotation) showing the **Wigley hull** (a standard mathematical benchmark hull form).
- **Interaction**: Switch between the Wigley hull and a scalable thin Diamond. Eventually introduce the "Final Form": a symmetric Bezier hull (similar to the starting state of the `loft` prototype).
- **Controls**: A 3D gizmo to change width, height, and depth.
- **Geometry**: The hull should only show one half, allowing the actual $f(x,z)$ curve to be boldly and solidly drawn.

### Slide 4: The Resistance Equation Walkthrough
- Step-by-step ELI5 walkthrough of Michell's wave resistance equation using the parametric hull we just built.
- Culminates in drawing the 2D heat map visualization (rendered on the XZ plane through the hull) to show *where* resistance is generated.

### Slide 5: "Thin Ships" and "Thiccness" (The Limitations)
- Explanation of the "thin ship" assumption required for Michell's integral. This is why we can't use a sphere or a wide rectangle (which we can show here as examples of broken math!).
- **Visualization**: An XY visualization showing the range of "thin angles" on each axis (using uniform X/Y pixel space) to show a "thin ship" versus a "thicc ship".
- **Interaction**: A "thiccness" slider. 
- **Easter Egg/UI Polish**: If the user pushes past ~30 degrees thicc, the screen starts to "blush" linearly up to a max (around 45 degrees) with a rosy vignette around the perimeter of the viewport.

### Slide 6: Parametric Hull Interactions
- Now that the math and its limits are understood, let the user play with a single hull:
  - **Speed Slider**: Change speed and watch resistance update.
  - **Scale**: Scale the hull up/down to observe how resistance changes at different scales.
  - **Rotate & Swap**: Rotate the camera and try other shapes, watching the heat map and total resistance update dynamically.

### Slide 7: Side-by-Side Visualizer
- **Split Screen**: Bring up two interactive parametric boat hull visualizers side-by-side to compare.
- **Visuals**: Show total resistance and a Heat Map for both.

### Slide 8: Swan vs. Raven Race
- Recreate Froude's Swan and Raven and place them in the side-by-side visualizer.
- **Interaction**: A single speed slider controls both screens.
- **Observation**: At low speeds, the Swan is faster. At high speeds, the Raven is faster.

### Slide 9: The "Wigley" Hull Optimization
- Explain what the Wigley hull is and how its mathematical definition is used as a benchmark to mathematically solve for the lowest possible wave resistance.

### Slide 10: Environmental Variables (Transition to Full Form)
- Introduce the "Full Form" prototype app. (The explainogram is essentially this app with certain features disabled per slide).
- **Interaction**: Allow the user to change water density and viscosity and see the effects on wave resistance.

### Slide 11: The Mathematical Proof
- A very high-level explanation of the mathematical proof that an optimal solution for minimum wave resistance exists.
- Focus on the significance: "It can be done," keeping the calculus of variations extremely basic.
