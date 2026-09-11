import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/* ---------------------------------------------------------
   PLACEHOLDER CONTENT — swap this out with real copy/projects
--------------------------------------------------------- */
const ROLE = "application developer";
const QUOTE = "building things that hold up under pressure";
const LINE_TWO = "turning complexity into something that justt works";
const LINE_THREE = "Making production worth the blast";
const CONTACT_EMAIL = "niranjandahal76@gmail.com";
const DISPLAY_NAME = "Niranjan Dahal";

/* ---------------------------------------------------------
   PARTICLE FIELD — organic blob/flow, morphs with scroll
--------------------------------------------------------- */
function useParticleField(mountRef, progressRef) {
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x08070c, 0.028);

    const camera = new THREE.PerspectiveCamera(
      60,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 9);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // --- build an organic point cloud (sphere-ish blob, noisy) ---
    const COUNT = 4200;
    const positions = new Float32Array(COUNT * 3);
    const basePositions = new Float32Array(COUNT * 3);
    const seeds = new Float32Array(COUNT);
    const colors = new Float32Array(COUNT * 3);

    const colorA = new THREE.Color(0x7c6fff); // violet
    const colorB = new THREE.Color(0x4fd1c5); // teal
    const colorC = new THREE.Color(0xff6b4a); // ember (rare accent)

    for (let i = 0; i < COUNT; i++) {
      // fibonacci sphere distribution for an even organic blob
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
      let c;
      if (mixT > 0.94) c = colorC.clone();
      else c = colorA.clone().lerp(colorB, mixT);
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
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // a soft inner glow sphere for depth
    const glowGeo = new THREE.SphereGeometry(1.4, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x2a2340,
      transparent: true,
      opacity: 0.5,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glow);

    let raf;
    let t = 0;
    const clock = new THREE.Clock();

    function animate() {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      t += dt;

      const progress = progressRef.current; // 0..1 across whole page

      const posAttr = geometry.attributes.position;
      const arr = posAttr.array;

      // morph strength grows as user scrolls — calm at top, most chaotic at the end
      const eased = Math.pow(progress, 1.7); // slow build, sharp ramp near the end
      const morph = prefersReducedMotion ? 0.1 : 0.1 + eased * 2.6;
      const spin = prefersReducedMotion ? 0 : t * (0.04 + eased * 0.12);

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

      points.rotation.y = spin + progress * Math.PI * 0.6;
      points.rotation.x = Math.sin(progress * Math.PI) * 0.25 + eased * Math.sin(t * 0.6) * 0.15;
      points.rotation.z = eased * Math.sin(t * 0.35) * 0.2;

      // camera drifts calmly at first, shakes and pushes in as it gets chaotic
      const shake = eased * 0.35;
      camera.position.z = 9 - progress * 6.8;
      camera.position.x = Math.sin(progress * Math.PI * 2) * 0.6 + Math.sin(t * 3.1) * shake;
      camera.position.y = Math.cos(t * 2.7) * shake * 0.6;
      camera.fov = 60 + progress * 16;
      camera.updateProjectionMatrix();

      glow.material.opacity = 0.5 - progress * 0.35;

      renderer.render(scene, camera);
    }
    animate();

    function onResize() {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [mountRef, progressRef]);
}

/* ---------------------------------------------------------
   SCROLL PROGRESS HOOK
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
   REVEAL WRAPPER — fades sections in as they cross viewport
--------------------------------------------------------- */
function Reveal({ children, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.3 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0px)" : "translateY(28px)",
        transition: "opacity 0.9s cubic-bezier(.2,.7,.2,1), transform 0.9s cubic-bezier(.2,.7,.2,1)",
      }}
    >
      {children}
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

  useParticleField(mountRef, progressRef);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        background: "#08070c",
        overflow: "hidden",
        fontFamily:
          "'Söhne', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500&family=Inter:wght@300;400;500;600&display=swap');
        .fr { font-family: 'Fraunces', serif; }
        .in { font-family: 'Inter', sans-serif; }
        ::selection { background: #7c6fff55; }
        .scrollarea { scrollbar-width: none; }
        .scrollarea::-webkit-scrollbar { display: none; }
        .navdot { transition: background 0.3s, transform 0.3s; }
        @media (prefers-reduced-motion: reduce) {
          * { scroll-behavior: auto !important; }
        }
      `}</style>

      {/* 3D background, fixed */}
      <div
        ref={mountRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
        }}
      />

      {/* vignette for legibility */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
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
          zIndex: 3,
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
                display >= i * 0.25 && display < (i + 1) * 0.25
                  ? "scale(1.7)"
                  : "scale(1)",
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
          zIndex: 2,
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
          }}
        >
          <div className="in" style={{ color: "#9d95c9", fontSize: "14px", letterSpacing: "0.02em", marginBottom: "18px" }}>
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
          <div
            className="in"
            onClick={() => scrollTo("about")}
            style={{
              marginTop: "56px",
              color: "#7c6fff",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span style={{ width: "24px", height: "1px", background: "#7c6fff" }} />
            scroll
          </div>
        </section>

        {/* ABOUT */}
        <section
          id="about"
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            padding: "0 8vw",
          }}
        >
          <Reveal className="fr">
            <p
              style={{
                color: "#e8e6f0",
                fontSize: "clamp(1.6rem, 3.6vw, 2.8rem)",
                lineHeight: 1.4,
                fontWeight: 300,
                maxWidth: "640px",
              }}
            >
              {LINE_TWO}
            </p>
          </Reveal>
        </section>

        {/* MORE */}
        <section
          id="more"
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            padding: "0 8vw",
          }}
        >
          <Reveal className="fr">
            <p
              style={{
                color: "#e8e6f0",
                fontSize: "clamp(1.6rem, 3.6vw, 2.8rem)",
                lineHeight: 1.4,
                fontWeight: 300,
                maxWidth: "640px",
              }}
            >
              {LINE_THREE}
            </p>
          </Reveal>
        </section>

        {/* CONTACT */}
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
          <Reveal>
            <span
              className="fr"
              style={{
                display: "block",
                color: "#f2f0f7",
                fontSize: "clamp(1.4rem, 3vw, 2rem)",
                fontWeight: 500,
              }}
            >
              {DISPLAY_NAME}
            </span>
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
          </Reveal>
        </section>
      </div>
    </div>
  );
}
