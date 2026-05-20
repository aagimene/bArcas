# Michell's Integral: Parametric vs. Non-Parametric Hulls

A common question when building hull design software is how Michell's wave resistance integral handles different types of mathematical geometry, specifically discrete meshes (non-parametric) versus Bezier surfaces (parametric).

## 1. Can you calculate Michell resistance on a non-parametric hull?
**Yes.** Michell's integral fundamentally relies on the longitudinal slope of the hull surface ($\partial y / \partial x$). 

If you have a non-parametric hull—such as a discrete point cloud, a mesh, or a table of traditional naval offsets—you do not have a continuous mathematical function $y = f(x,z)$. However, you can still solve the integral using **discrete numerical integration**:
- **Panel Methods:** The hull is divided into flat or slightly curved panels. The slope is calculated geometrically for each panel, and the integral is summed across all panels.
- **Finite Differences:** You can approximate the derivative $\partial y / \partial x$ at any point by looking at the difference in width between neighboring discrete points.

This is exactly how classic hull analysis software (like Michlet) operates. They take discrete offsets, fit splines or panels to them, and integrate numerically.

## 2. Can a Bezier hull be defined parametrically for Michell's equations?
**Yes, perfectly.** In fact, Bezier surfaces are inherently parametric. 

A Bezier surface is defined by parameters $(u, v)$ mapping to 3D coordinates: $X(u,v), Y(u,v), Z(u,v)$. 
Michell's classic equation is usually written as $y = f(x,z)$ (where $y$ is the half-breadth). 
As long as the hull does not fold back on itself (e.g., no severe tumblehome or overhangs that would cause multiple $y$ values for a single $x,z$ coordinate), a Bezier surface is actually **ideal** for Michell's integral for two reasons:
1. **Analytical Derivatives:** Unlike discrete meshes, you can calculate the *exact* mathematical slope ($\partial y / \partial x$) at any point on a Bezier surface using calculus. This eliminates the approximation errors of finite differences.
2. **Smoothness:** Bezier surfaces are perfectly fair and continuous, meaning the highly oscillatory integrals in Michell's equation behave much more predictably and accurately during numerical integration.

### Summary for bArcas
For the `loft` prototype (and the "final form" of the `michell` prototype), defining the hull as a symmetric Bezier surface is the optimal approach. It allows us to calculate exact analytical slopes and feed them into a neat, precise numerical integrator in JavaScript to get accurate wave resistance.
