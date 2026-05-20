# Michell Prototype TODO

This is a VERY high-level task list for building the `michell` prototype. The plan is structured around Human QA Checkpoints, as AI relies on human feedback to verify 3D graphics, aesthetics, and complex user interfaces.

## Phase 1: Engine and Architecture
- [ ] Initialize the `michell` prototype directory (HTML/JS/CSS structure).
- [ ] Implement the Slide/Presentation state machine (Next/Prev controls, disabling/enabling UI features per slide).
- [ ] Set up the 3D rendering canvas (e.g., using Three.js) with basic lighting, camera rotation, and the RGB Vector Gizmo.
- [ ] **HUMAN QA CHECKPOINT**: Verify that the slide transitions work, the 3D scene renders smoothly, and the XYZ vector colors (RGB) look bold and correct.

## Phase 2: Geometry and Parameterization Basics
- [ ] Implement the mathematical generation for the basic ELI5 math surface, the Wigley hull, and thin primitive shapes (Diamond, Wedge).
- [ ] Implement the sphere/rectangle purely as "broken math" visual examples for the Thiccness slide.
- [ ] Implement the half-hull rendering technique so the $f(x,z)$ curve can be boldly outlined.
- [ ] Add the 3D Gizmo for scaling Width, Height, and Depth.
- [ ] **HUMAN QA CHECKPOINT**: Visually inspect the half-hull rendering. Ensure the bold $f(x,z)$ line is prominent and that the 3D scaling gizmo is intuitive and functional.

## Phase 3: Analytics and Heat Maps
- [ ] Implement the Michell wave resistance calculation (or an appropriate approximation for real-time JS).
- [ ] Implement the 2D Heat Map rendering on the XZ plane through the hull.
- [ ] Create the split-screen side-by-side visualizer mode.
- [ ] **HUMAN QA CHECKPOINT**: Verify the heat map accurately reflects the hull geometry and updates dynamically. Confirm the split-screen view looks clean and responsive.

## Phase 4: UI Interactions and Easter Eggs
- [ ] Link the Speed, Scale, and "Thiccness" sliders to the 3D math and heat map calculations.
- [ ] Implement the "blush" (rosy vignette) effect when thiccness exceeds 30 degrees.
- [ ] Implement the uniform X/Y pixel space visualization for the "Thin Ships" slide.
- [ ] **HUMAN QA CHECKPOINT**: Test the slider interactions. Ensure the blush vignette effect is aesthetically pleasing and triggers correctly.

## Phase 5: Content, History, and Polish
- [ ] Integrate historical images, diagrams, and text for Froude's Swan and Raven.
- [ ] Recreate the Swan and Raven hull models for the side-by-side race.
- [ ] Implement the environmental variable sliders (density, viscosity) for the full-form editor.
- [ ] Populate all ELI5 text, color-coded equations, and the high-level mathematical proof.
- [ ] **HUMAN QA CHECKPOINT**: Full playthrough of the explainogram to ensure narrative flow, correct color-coding, and overall "WOW" factor for the design aesthetics.
