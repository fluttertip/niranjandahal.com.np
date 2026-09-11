import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

/* ---------------------------------------------------------
   CONTENT — keep it sparse, keep it deliberate
--------------------------------------------------------- */
const ROLE = "application developer";
const QUOTE = "building things that hold up under pressure";
const LINE_TWO = "turning complexity into something that just works";
const LINE_THREE = "making production worth the blast";
const CONTACT_EMAIL = "niranjandahal76@gmail.com";
const DISPLAY_NAME = "Niranjan Dahal";

/* ---------------------------------------------------------
   PREFERS REDUCED MOTION
--------------------------------------------------------- */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = (e) => setReduced(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

/* ---------------------------------------------------------
   BUILD A SPARSE NEAREST-NEIGHBOR NETWORK (once, from base positions)
   grid-bucketed so it stays O(n) instead of O(n^2)
--------------------------------------------------------- */
function buildConnections(basePositions, count, cellSize, maxPerPoint) {
  const grid = new Map();
  const key = (x, y, z) =>
    `${Math.floor(x / cellSize)}_${Math.floor(y / cellSize)}_${Math.floor(z / cellSize)}`;

  for (let i = 0; i < count; i++) {
    const x = basePositions[i * 3];
    const y = basePositions[i * 3 + 1];
    const z = basePositions[i * 3 + 2];
    const k = key(x, y, z);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }

  const degree = new Uint8Array(count);
  const connections = [];

  for (let i = 0; i < count; i++) {
    if (degree[i] >= maxPerPoint) continue;
    const x = basePositions[i * 3];
    const y = basePositions[i * 3 + 1];
    const z = basePositions[i * 3 + 2];
    const cx = Math.floor(x / cellSize);
    const cy = Math.floor(y / cellSize);
    const cz = Math.floor(z / cellSize);

    let bestJ = -1;
    let bestD = Infinity;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const arr = grid.get(`${cx + dx}_${cy + dy}_${cz + dz}`);
          if (!arr) continue;
          for (const j of arr) {
            if (j === i || degree[j] >= maxPerPoint) continue;
            const ddx = basePositions[j * 3] - x;
            const ddy = basePositions[j * 3 + 1] - y;
            const ddz = basePositions[j * 3 + 2] - z;
            const d = ddx * ddx + ddy * ddy + ddz * ddz;
            if (d < bestD) {
              bestD = d;
              bestJ = j;
            }
          }
        }
      }
    }

    if (bestJ >= 0 && bestD < cellSize * cellSize * 2.2) {
      connections.push(i, bestJ);
      degree[i]++;
      degree[bestJ]++;
    }
  }

  return new Int32Array(connections);
}

/* ---------------------------------------------------------
   PARTICLE FIELD — a stable, connected lattice that comes apart
   the further you scroll. Mouse gives it a faint pulse of life.
--------------------------------------------------------- */
function useParticleField(mountRef, progressRef, reducedMotion) {
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x08070c, 0.028);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 9);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const setSize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    setSize();

    const COUNT = 4200;
    const positions = new Float32Array(COUNT * 3);
    const basePositions = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);

    const colorA = new THREE.Color(0x7c6fff);
    const colorB = new THREE.Color(0x4fd1c5);
    const colorC = new THREE.Color(0xff6b4a);

    for (let i = 0; i < COUNT; i++) {
      const t = i / COUNT;
      const inc = Math.acos(1 - 2 * t);
      const az = Math.PI * (1 + Math.sqrt(5)) * i;
      const r = 3.1 + Math.random() * 0.9;

      const x = r * Math.sin(inc) * Math.cos(az);
      const y = r * Math.sin(inc) * Math.sin(az);
      const z = r * Math.cos(inc);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      basePositions[i * 3] = x;
      basePositions[i * 3 + 1] = y;
      basePositions[i * 3 + 2] = z;
      seeds[i] = Math.random() * 1000;

      const mixT = Math.random();
      const c = mixT > 0.94 ? colorC.clone() : colorA.clone().lerp(colorB, mixT);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.028,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // sparse constellation network — the "stable" signal at the top of the page
    const connections = buildConnections(basePositions, COUNT, 0.62, 2);
    const linePositions = new Float32Array(connections.length * 3);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x8f89e0,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lines);

    const glowGeo = new THREE.SphereGeometry(1.4, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x2a2340,
      transparent: true,
      opacity: 0.5,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glow);

    // faint mouse-driven life — damped, never jarring
    const mouse = { x: 0, y: 0 };
    const mouseLerped = { x: 0, y: 0 };
    const onMouseMove = (e) => {
      const rect = mount.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    };
    if (!reducedMotion) window.addEventListener("mousemove", onMouseMove);

    let raf;
    let t = 0;
    const clock = new THREE.Clock();

    function animate() {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      t += dt;

      const progress = progressRef.current;
      const posAttr = geometry.attributes.position;
      const arr = posAttr.array;

      const eased = Math.pow(progress, 1.7);
      const morph = reducedMotion ? 0.08 : 0.1 + eased * 2.6;
      const spin = reducedMotion ? 0 : t * (0.04 + eased * 0.12);

      mouseLerped.x += (mouse.x - mouseLerped.x) * 0.03;
      mouseLerped.y += (mouse.y - mouseLerped.y) * 0.03;

      for (let i = 0; i < COUNT; i++) {
        const bx = basePositions[i * 3];
        const by = basePositions[i * 3 + 1];
        const bz = basePositions[i * 3 + 2];
        const s = seeds[i];

        const n =
          Math.sin(bx * 1.4 + t * 0.4 + s) *
          Math.cos(by * 1.4 + t * 0.3 + s) *
          Math.sin(bz * 1.4 + t * 0.35 + s);

        const disperse = 1 + n * 0.22 * morph + eased * 1.4 * Math.sin(s + eased * 5);

        arr[i * 3] = bx * disperse;
        arr[i * 3 + 1] = by * disperse + Math.sin(t * 0.2 + s) * 0.05;
        arr[i * 3 + 2] = bz * disperse;
      }
      posAttr.needsUpdate = true;

      // network follows the same points, then dissolves as chaos rises
      const linePos = lineGeometry.attributes.position.array;
      for (let k = 0; k < connections.length; k++) {
        const idx = connections[k];
        linePos[k * 3] = arr[idx * 3];
        linePos[k * 3 + 1] = arr[idx * 3 + 1];
        linePos[k * 3 + 2] = arr[idx * 3 + 2];
      }
      lineGeometry.attributes.position.needsUpdate = true;
      lineMaterial.opacity = Math.max(0, 1 - eased * 1.35) * 0.32;

      points.rotation.y = spin + progress * Math.PI * 0.6 + mouseLerped.x * 0.12;
      points.rotation.x =
        Math.sin(progress * Math.PI) * 0.25 + eased * Math.sin(t * 0.6) * 0.15 + mouseLerped.y * 0.08;
      points.rotation.z = eased * Math.sin(t * 0.35) * 0.2;
      lines.rotation.copy(points.rotation);

      const shake = reducedMotion ? 0 : eased * 0.35;
      camera.position.z = 9 - progress * 6.8;
      camera.position.x = Math.sin(progress * Math.PI * 2) * 0.6 + Math.sin(t * 3.1) * shake + mouseLerped.x * 0.25;
      camera.position.y = Math.cos(t * 2.7) * shake * 0.6 + mouseLerped.y * 0.18;
      camera.fov = 60 + progress * 16;
      camera.updateProjectionMatrix();

      glow.material.opacity = 0.5 - progress * 0.35;

      renderer.render(scene, camera);
    }
    animate();

    const ro = new ResizeObserver(setSize);
    ro.observe(mount);
    window.addEventListener("resize", setSize);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", setSize);
      window.removeEventListener("mousemove", onMouseMove);
      geometry.dispose();
      material.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [mountRef, progressRef, reducedMotion]);
}

/* ---------------------------------------------------------
   SCROLL PROGRESS
--------------------------------------------------------- */
function useScrollProgress(containerRef) {
  const progressRef = useRef(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onScroll() {
      const max = el.scrollHeight - el.clientHeight;
      const p = max > 0 ? el.scrollTop / max : 0;
      progressRef.current = p;
      setDisplay(p);
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [containerRef]);

  return { progressRef, display };
}

/* ---------------------------------------------------------
   DISTORT TEXT — words hold a scatter offset that settles toward
   "chaos" (0 = perfectly calm, 1 = fully unsettled). The same
   number that drives the particle field drives the type.
--------------------------------------------------------- */
function DistortText({ text, chaos, style, reducedMotion }) {
  const words = text.split(" ");
  return (
    <span style={{ ...style, display: "inline-block" }}>
      {words.map((w, i) => {
        const seedA = ((i * 37) % 97) / 97 - 0.5;
        const seedB = ((i * 53) % 89) / 89 - 0.5;
        const c = reducedMotion ? 0 : chaos;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              transform: `translate(${seedA * 20 * c}px, ${seedB * 14 * c}px) rotate(${seedA * 9 * c}deg)`,
              transitionProperty: "transform",
              transitionDuration: "0.6s",
              transitionTimingFunction: "cubic-bezier(.2,.7,.2,1)",
              transitionDelay: `${i * 22}ms`,
              marginRight: "0.3em",
            }}
          >
            {w}
          </span>
        );
      })}
    </span>
  );
}

/* ---------------------------------------------------------
   STORY LINE — a DistortText that assembles into place on first
   view, then keeps tracking the page's overall chaos level.
--------------------------------------------------------- */
function StoryLine({ text, restChaos, style, reducedMotion }) {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setRevealed(true);
      },
      { threshold: 0.4 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: revealed ? 1 : 0,
        transition: "opacity 0.7s ease-out",
      }}
    >
      <DistortText
        text={text}
        chaos={revealed ? restChaos : 1}
        style={style}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}

/* ---------------------------------------------------------
   MAIN COMPONENT
--------------------------------------------------------- */
export default function Portfolio() {
  const mountRef = useRef(null);
  const scrollRef = useRef(null);
  const { progressRef, display } = useScrollProgress(scrollRef);
  const reducedMotion = usePrefersReducedMotion();

  useParticleField(mountRef, progressRef, reducedMotion);

  const scrollTo = useCallback((id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const grainSvg =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`
    );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100dvh",
        background: "#08070c",
        overflow: "hidden",
        fontFamily: "'Söhne', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <style>{`
        html, body, #root { height: 100%; margin: 0; padding: 0; }
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500&family=Inter:wght@300;400;500;600&display=swap');
        .fr { font-family: 'Fraunces', serif; }
        .in { font-family: 'Inter', sans-serif; }
        ::selection { background: #7c6fff55; }
        .scrollarea { scrollbar-width: none; }
        .scrollarea::-webkit-scrollbar { display: none; }
        .navdot { transition: background 0.3s, transform 0.3s; }
        @keyframes driftline {
          0% { transform: translateY(0); opacity: 0.9; }
          50% { transform: translateY(14px); opacity: 0.25; }
          100% { transform: translateY(28px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { scroll-behavior: auto !important; animation: none !important; }
        }
      `}</style>

      {/* 3D background, fixed */}
      <div ref={mountRef} style={{ position: "absolute", inset: 0, zIndex: 0 }} />

      {/* grain — cheap texture so the black never reads flat */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          backgroundImage: `url("${grainSvg}")`,
          opacity: 0.035,
          mixBlendMode: "overlay",
        }}
      />

      {/* vignette for legibility */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at 50% 40%, transparent 0%, rgba(8,7,12,0.55) 65%, rgba(8,7,12,0.95) 100%)",
        }}
      />

      {/* side progress rail */}
      <div
        style={{
          position: "absolute",
          right: "28px",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 4,
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        {["hero", "about", "more", "contact"].map((id, i) => (
          <div
            key={id}
            onClick={() => scrollTo(id)}
            className="navdot"
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              cursor: "pointer",
              background:
                display >= i * 0.25 && display < (i + 1) * 0.25
                  ? "#e8e6f0"
                  : "rgba(232,230,240,0.28)",
              transform:
                display >= i * 0.25 && display < (i + 1) * 0.25 ? "scale(1.7)" : "scale(1)",
            }}
          />
        ))}
      </div>

      {/* scrollable content */}
      <div
        ref={scrollRef}
        className="scrollarea"
        style={{
          position: "relative",
          zIndex: 3,
          height: "100%",
          overflowY: "auto",
          scrollBehavior: "smooth",
        }}
      >
        {/* HERO */}
        <section
          id="hero"
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 8vw",
            maxWidth: "900px",
            position: "relative",
          }}
        >
          <div
            className="in"
            style={{ color: "#9d95c9", fontSize: "14px", letterSpacing: "0.02em", marginBottom: "18px" }}
          >
            {ROLE}
          </div>
          <h1
            className="fr"
            style={{
              color: "#f2f0f7",
              fontSize: "clamp(2.4rem, 6.4vw, 4.6rem)",
              fontWeight: 500,
              lineHeight: 1.12,
              margin: 0,
              maxWidth: "760px",
            }}
          >
            {QUOTE}
          </h1>

          {/* wordless scroll cue — a line that drifts and dissolves, and fades for good the moment you actually scroll */}
          <div
            style={{
              position: "absolute",
              bottom: "48px",
              left: "8vw",
              width: "1px",
              height: "40px",
              overflow: "hidden",
              opacity: Math.max(0, 1 - display * 14),
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                width: "1px",
                height: "16px",
                background: "linear-gradient(#7c6fff, transparent)",
                animation: reducedMotion ? "none" : "driftline 2.2s ease-in-out infinite",
              }}
            />
          </div>
        </section>

        {/* ABOUT */}
        <section
          id="about"
          style={{ minHeight: "100vh", display: "flex", alignItems: "center", padding: "0 8vw" }}
        >
          <StoryLine
            text={LINE_TWO}
            restChaos={0.12}
            reducedMotion={reducedMotion}
            style={{
              color: "#e8e6f0",
              fontSize: "clamp(1.6rem, 3.6vw, 2.8rem)",
              lineHeight: 1.4,
              fontWeight: 300,
              maxWidth: "640px",
            }}
          />
        </section>

        {/* MORE */}
        <section
          id="more"
          style={{ minHeight: "100vh", display: "flex", alignItems: "center", padding: "0 8vw" }}
        >
          <StoryLine
            text={LINE_THREE}
            restChaos={0.5}
            reducedMotion={reducedMotion}
            style={{
              color: "#e8e6f0",
              fontSize: "clamp(1.6rem, 3.6vw, 2.8rem)",
              lineHeight: 1.4,
              fontWeight: 300,
              maxWidth: "640px",
            }}
          />
        </section>

        {/* CONTACT — the one calm point after everything comes apart */}
        <section
          id="contact"
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "0 8vw",
          }}
        >
          <StoryLine
            text={DISPLAY_NAME}
            restChaos={0.04}
            reducedMotion={reducedMotion}
            style={{ color: "#f2f0f7", fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 500 }}
          />
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="fr"
            style={{
              display: "block",
              marginTop: "14px",
              color: "#9d95c9",
              fontSize: "clamp(1.1rem, 2.2vw, 1.5rem)",
              fontWeight: 300,
              textDecoration: "none",
            }}
          >
            {CONTACT_EMAIL}
          </a>
        </section>
      </div>
    </div>
  );
}