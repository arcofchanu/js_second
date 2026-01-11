<div align="center">


# 🌸 DIGITAL FLORA

**Interactive 3D Particle Flower with Hand Gesture Control**

</div>

---

## ✨ Features

### 🎨 3D Particle Rose/Tulip
- **190,000+ particles** forming a beautiful procedural flower
- Flower head, stem, and leaves all rendered as point clouds
- Custom GLSL shaders with tulip-style petal displacement
- Additive blending for ethereal glow effect

### 🔨 Laser Construction Effect
- Particles "materialize" from corner laser beams
- Top-to-bottom scanning construction animation
- Hot pink sintering flash as particles arrive
- 8 tracking beams from cube corners

### ✋ Hand Gesture Controls (MediaPipe)

| Gesture | Hand | Effect |
|---------|------|--------|
| **Pinch & Drag** | Right (Primary) | Control flower construction - drag up/down to build/unbuild |
| **Pinch** | Left (Secondary) | **Distort the flower** with wild chaotic effects |
| **Release** | Either | Smooth auto-snap to nearest state |

### 🌀 Distortion Effect
When pinching with your second hand:
- **Spiral twist** - Intense 4x rotation with random variation
- **Particle explosion** - 3x outward scatter
- **Vertical chaos** - Wild up/down displacement
- **Multi-color glow** - Hot pink, cyan, and gold glitch effect
- **Flickering alpha** - Glitchy transparency

## 🚀 Run Locally

**Prerequisites:** Node.js, Webcam

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the app:
   ```bash
   npm run dev
   ```

3. Allow camera access when prompted

## 🎮 Controls

- **Right Hand Pinch + Drag Up/Down**: Build or deconstruct the flower
- **Left Hand Pinch**: Distort and scatter the flower particles
- **Release Pinch**: Flower smoothly returns to normal

## 🛠️ Tech Stack

- **React** + **TypeScript**
- **Three.js** + **React Three Fiber**
- **Custom GLSL Shaders**
- **MediaPipe Hand Landmarker**
- **Vite** for bundling
- **Tailwind CSS** for UI

## 📁 Project Structure

```
├── App.tsx              # Main app with hand tracking logic
├── components/
│   ├── Rose.tsx         # 3D particle flower with shaders
│   ├── RoseExperience.tsx # Three.js canvas setup
│   └── UI.tsx           # UI components
├── types.ts             # TypeScript interfaces
└── index.tsx            # Entry point
```

## 🎨 Configuration

Edit `CINEMATIC_CONFIG` in `App.tsx`:

```typescript
{
  color: '#7c00ff',      // Flower color
  petalCount: 3.0,       // Number of petals
  twist: 0.8,            // Petal twist amount
  openness: 0.6,         // Bloom openness
  detail: 0.5,           // Surface noise detail
  speed: 0.15,           // Animation speed
  particleSize: 0.022,   // Particle size
}
```

---

<div align="center">
Made with 💜 using Three.js and MediaPipe
</div>
