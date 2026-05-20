# Michell Prototype: Clarifying Questions and AI Directions

> **Note to AI Assistant (Antigravity):** Read this file when planning the next steps for the `michell` prototype. Do not rely on memory for these questions and directives.

## Clarifications (RESOLVED)

1. **Wigley Hull:**
   *Resolved:* Yes, using the standard Wigley benchmark hull.

2. **Swan and Raven Hull Lines:**
   *Resolved:* We will use mathematical approximations based on their known block forms (bluff vs sharp), or use established equations if they exist in literature.

3. **Presentation Framework:**
   *Resolved:* Vanilla HTML/JS/CSS (similar to the `loft` prototype) so that the numerical integrator can eventually be ported directly back into the loft app.

4. **Rectangle & Sphere (Thin Ship Violation):**
   *Resolved:* We will remove the sphere, rectangle, and wedge. The explainogram will use the Wigley hull and a scalable Diamond. The "final form" prototype will introduce a symmetric Bezier hull (similar to loft's starting state).

5. **Heat Map Calculation Performance:**
   *Resolved:* We will build a neat, precise numerical integrator directly in JavaScript, utilizing typed arrays and caching where possible to optimize the triple integral calculations.

## Directives for Next Steps (For the AI)
- **Aesthetics First**: Keep the design rich, dynamic, and aesthetic. Use modern web design practices (vibrant colors, glassmorphism, dynamic animations, modern typography like Inter/Roboto).
- **Modularity**: Ensure the "explainogram" state logic can easily transition into the "Full Form" editor (disabling/enabling features).
- **Step-by-step Execution**: When authorized to begin, decompose the first task in `michell-todo.md` into a detailed implementation plan.
- **Do not guess visuals**: Strictly adhere to the Human QA Checkpoints defined in the TODO. Stop and ask the user to verify graphics and UI.
