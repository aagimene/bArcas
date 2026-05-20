# Michell Prototype: Clarifying Questions and AI Directions

> **Note to AI Assistant (Antigravity):** Read this file when planning the next steps for the `michell` prototype. Do not rely on memory for these questions and directives.

## Clarifications Needed from the User

1. **Wrigley vs. Wigley Hull:**
   You mentioned the "Wrigley" hull. Based on naval architecture research, the standard mathematical benchmark for wave resistance is the **Wigley hull** (defined by simple parabolic equations). I have used "Wigley" in the plan, but please confirm if you specifically meant a different "Wrigley" hull!

2. **Swan and Raven Hull Lines:**
   Do we already have the hull line data/equations for Froude's Swan and Raven to recreate them in 3D for the prototype, or should I attempt to mathematically approximate them based on historical diagrams?

3. **Presentation Framework:**
   Should the "explainogram" be built as a vanilla HTML/JS/CSS app (similar to the `loft` prototype), or would you prefer using a framework like React (with React Three Fiber) or a presentation library like Reveal.js?

4. **Rectangle & Sphere (Thin Ship Violation):**
   You initially requested including primitive shapes like the Cylinder, Rectangle, and Sphere. Because Michell's integral is strictly based on "thin ship" theory, bluff bodies like a sphere or a wide rectangle severely violate the underlying assumptions (flow separation and viscous drag would dominate in reality). 
   *Question:* Should we include them specifically to demonstrate how and why the theory breaks down (perhaps tying this into the "Thiccness" slide), or should we remove them and stick to shapes that can realistically be scaled into thin ships (like the Diamond, Wedge/Triangle, and Wigley)?

5. **Heat Map Calculation Performance:**
   Michell's integral is mathematically straightforward but computationally intensive for real-time interaction in JavaScript due to triple integrals. Should we use an approximation/simplified pre-calculated model for the primitive shapes, or do you want to implement a numerical integrator in JS?

## Directives for Next Steps (For the AI)
- **Aesthetics First**: Keep the design rich, dynamic, and aesthetic. Use modern web design practices (vibrant colors, glassmorphism, dynamic animations, modern typography like Inter/Roboto).
- **Modularity**: Ensure the "explainogram" state logic can easily transition into the "Full Form" editor (disabling/enabling features).
- **Step-by-step Execution**: When authorized to begin, decompose the first task in `michell-todo.md` into a detailed implementation plan.
- **Do not guess visuals**: Strictly adhere to the Human QA Checkpoints defined in the TODO. Stop and ask the user to verify graphics and UI.
