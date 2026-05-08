# 🔍 Graph Algorithm Visualizer

An interactive visualizer for four fundamental graph algorithms with step-by-step execution control. Built with vanilla HTML, CSS, and JavaScript — no frameworks or dependencies.

---

## ⚙️ Algorithms

| Algorithm | Type | Real-World Use Case |
|-----------|------|---------------------|
| **Dijkstra** | Shortest Path | GPS navigation, network routing |
| **Bellman-Ford** | Shortest Path | Negative weight graphs, currency arbitrage detection |
| **Prim** | Minimum Spanning Tree | Network infrastructure design, cable layout optimization |
| **Kruskal** | Minimum Spanning Tree | Cluster analysis, power grid planning |

---

## ✨ Features

- **Interactive canvas** — add nodes and edges by clicking, drag to reposition
- **Directed / undirected** graph toggle
- **Custom edge weights** — including negative weights for Bellman-Ford
- **Step-by-step execution** — forward and backward controls to trace every decision
- **Real-time distance table** — tracks tentative and finalized distances per node
- **Color-coded states** — start, end, visited, current, shortest path, MST edges
- **Preset graphs** for quick algorithm comparison
- Move, delete, and full reset controls

---

## 🔬 Algorithm Comparison

One of the key insights this visualizer demonstrates:

- **Dijkstra** is faster (O((V+E) log V)) but fails on negative weights
- **Bellman-Ford** handles negative weights at the cost of higher complexity (O(V·E))
- **Prim** builds MST greedily from a starting node — efficient on dense graphs
- **Kruskal** sorts all edges first — more efficient on sparse graphs

Try the same graph on Dijkstra vs. Bellman-Ford to observe the step count difference directly.

---

## 🎨 Stack

- Vanilla JavaScript — algorithm logic and SVG rendering
- SVG canvas — node/edge drawing, arrow markers, animation
- CSS custom properties — fully themeable dark UI

---

## 🚀 Getting Started

No installation needed:

```bash
open index.html
```

Or serve locally:

```bash
npx serve .
```

---

## 🗂️ File Structure


```bash
├── index.html   # Layout and SVG canvas
├── algo.css     # Styling and CSS theme variables
└── algo.js      # Algorithm logic, step engine, rendering
```

---


## 📄 License

MIT License. Feel free to use and modify.
