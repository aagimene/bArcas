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

### Slide 2: Defining an Underwater Boat Hull
- **Concept**: The hull defined as a parametric equation $y = f(x, z)$.
- **3D Visualization**: Interactive (camera rotation) showing the **Wigley hull** (a standard mathematical benchmark hull form, commonly misspelled as Wrigley).
- **Interaction**: Dropdown/buttons to switch between the Wigley hull and primitive shapes (Cylinder, Rectangle, Triangle, Diamond, Sphere).
- **Controls**: A 3D gizmo to change width, height, and depth.
- **Data**: Show the corresponding equations and calculated wave resistances live.

### Slide 3: Side-by-Side Visualizer
- **Split Screen**: Two interactive parametric boat hull visualizers side-by-side.
- **Visuals**: Show total resistance and a Heat Map.
- **Heat Map Details**: Rendered on the XZ plane through the hull.
- **Geometry**: The hull should only show one half, allowing the actual $f(x,z)$ line to be boldly and solidly drawn.

### Slide 4: Parameterization (ELI5)
- Explain the concept of $y = f(x, z)$ to a 5-year-old.
- **Gizmo**: Vector arrow gizmo with bold R, G, B colors representing the X, Y, Z directions.
- **Visuals**: The equation itself will be color-coded to match the XYZ vectors. Show the simple Wigley hull.

### Slide 5: The Resistance Equation Walkthrough
- Step-by-step ELI5 walkthrough of Michell's wave resistance equation using a simple parametric hull.
- Culminates in drawing the 2D heat map visualization to show where resistance is generated.

### Slide 6: Parametric Hull Interactions
- Walk through different interactions using the side-by-side view:
  - **Speed Slider**: Change speed and watch resistance update.
  - **Scale**: Scale the hull up/down to observe how resistance changes at different scales with the same shape.
  - **Rotate & Swap**: Rotate the camera and try other shapes, watching the heat map and total resistance update dynamically.

### Slide 7: The "Wigley" Hull Optimization
- Explain what the Wigley hull is and how its mathematical definition is used as a benchmark to solve for optimized wave resistance.

### Slide 8: "Thin Ships" and "Thiccness"
- Explanation of the "thin ship" assumption required for Michell's integral.
- **Visualization**: An XY visualization showing the range of "thin angles" on each axis (using uniform X/Y pixel space) to show the true shape of a "thin ship" versus a "thicc ship".
- **Interaction**: A "thiccness" slider. 
- **Easter Egg/UI Polish**: If the user pushes past ~30 degrees thicc, the screen starts to "blush" linearly up to a max (around 45 degrees) with a rosy vignette around the perimeter of the viewport.

### Slide 9: Swan vs. Raven Race
- Recreate Froude's Swan and Raven and place them in the side-by-side visualizer.
- **Interaction**: A single speed slider controls both screens.
- **Observation**: At low speeds, the Swan is faster. At high speeds, the Raven is faster.

### Slide 10: Environmental Variables (Transition to Full Form)
- Introduce the "Full Form" prototype app. (The explainogram is essentially this app with certain features disabled per slide).
- **Interaction**: Allow the user to change water density and viscosity and see the effects on wave resistance.

### Slide 11: The Mathematical Proof
- A very high-level explanation of the mathematical proof that an optimal solution for minimum wave resistance exists.
- Focus on the significance: "It can be done," keeping the calculus of variations extremely basic.
