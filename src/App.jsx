import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

/* ---------------------------------------------------------
   CONTENT — sparse, deliberate. nothing sells anything.
--------------------------------------------------------- */
const QUOTE = "building apps that hold together under pressure";
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
   NARROW VIEWPORT (mobile) — used to move the side nav dots
   into a bottom bar instead of overlapping the text column
--------------------------------------------------------- */
function useIsNarrow() {
  const [narrow, setNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 640 : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setNarrow(mq.matches);
    const fn = (e) => setNarrow(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return narrow;
}

function hexLerp(hexA, hexB, t) {
  const a = new THREE.Color(hexA);
  const b = new THREE.Color(hexB);
  return a.lerp(b, Math.max(0, Math.min(1, t)));
}
function cssLerp(hexA, hexB, t) {
  const c = hexLerp(hexA, hexB, t);
  return `#${c.getHexString()}`;
}

/* ---------------------------------------------------------
   THE FIELD

   Four torus knots — the same topological family (p,q) at
   different scale and orientation, like different resonant
   modes of one compactified geometry. At rest they read as a
   single deliberate sculptural object, breathing gently. As
   you descend the page: the minor radius picks up higher
   harmonics (the string vibrating), the major radius starts to
   wobble per-angle (the loop itself losing its shape), and an
   out-of-plane noise term grows until the knot stops closing
   on itself at all — order unraveling into the same kind of
   scattered noise a fibonacci dust field would show on its
   own. A sparse, ever-present particle "foam" in the background
   brightens and jitters more as the knots fray, so the chaos
   feels like it is leaking out of the shape rather than
   arriving from nowhere.
--------------------------------------------------------- */
const WARM_TARGET = 0xff6a3d;

const KNOT_DEFS = [
  { p: 2, q: 7, R: 2.5, r: 0.85, rot: [0.28, 0.55, 0.08], hue: 0x6a5cff, segs: 280 },
  { p: 2, q: 7, R: 1.65, r: 0.5, rot: [1.05, -0.4, 0.75], hue: 0x49c9ff, segs: 220 },
  { p: 2, q: 7, R: 1.85, r: 0.55, rot: [-0.7, 1.25, -0.5], hue: 0x4dffb0, segs: 220 },
  { p: 2, q: 7, R: 1.2, r: 0.38, rot: [0.9, 0.85, 1.35], hue: 0xff5da2, segs: 180 },
];

function rotateVec(x, y, z, rx, ry, rz) {
  // rotate about X
  let cy1 = Math.cos(rx), sy1 = Math.sin(rx);
  let y1 = y * cy1 - z * sy1;
  let z1 = y * sy1 + z * cy1;
  // about Y
  let cx2 = Math.cos(ry), sx2 = Math.sin(ry);
  let x2 = x * cx2 + z1 * sx2;
  let z2 = -x * sx2 + z1 * cx2;
  // about Z
  let cz3 = Math.cos(rz), sz3 = Math.sin(rz);
  let x3 = x2 * cz3 - y1 * sz3;
  let y3 = x2 * sz3 + y1 * cz3;
  return [x3, y3, z2];
}

function useKnotField(mountRef, progressRef, reducedMotion) {
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05060c, 0.024);

    const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 100);
    camera.position.set(0, 0, 9.5);

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
    // Web fonts swapping in can shift layout by a pixel right after
    // mount, which would otherwise leave the canvas briefly mis-sized.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(setSize).catch(() => {});
    }
    // Belt-and-suspenders: re-measure once more after first paint.
    const rafSize = requestAnimationFrame(setSize);

    const group = new THREE.Group();
    scene.add(group);

    const knots = KNOT_DEFS.map((def, ki) => {
      const segs = def.segs;
      const core = new Float32Array(segs * 3);
      const halo = new Float32Array(segs * 3);
      const coreGeo = new THREE.BufferGeometry();
      coreGeo.setAttribute("position", new THREE.BufferAttribute(core, 3));
      const haloGeo = new THREE.BufferGeometry();
      haloGeo.setAttribute("position", new THREE.BufferAttribute(halo, 3));

      const coreMat = new THREE.LineBasicMaterial({
        color: def.hue,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const haloMat = new THREE.LineBasicMaterial({
        color: def.hue,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const coreLine = new THREE.LineLoop(coreGeo, coreMat);
      const haloLine = new THREE.LineLoop(haloGeo, haloMat);
      group.add(coreLine, haloLine);

      return { def, core, halo, coreGeo, haloGeo, coreMat, haloMat, coreLine, haloLine, phase: ki * 1.7 };
    });

    // background quantum foam — always present, brightens with depth
    const DUST = 900;
    const dustBase = new Float32Array(DUST * 3);
    const dustPos = new Float32Array(DUST * 3);
    const dustSeed = new Float32Array(DUST);
    for (let i = 0; i < DUST; i++) {
      const rad = 5 + Math.random() * 4.5;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(1 - 2 * Math.random());
      const x = rad * Math.sin(ph) * Math.cos(th);
      const y = rad * Math.sin(ph) * Math.sin(th);
      const z = rad * Math.cos(ph);
      dustBase[i * 3] = x;
      dustBase[i * 3 + 1] = y;
      dustBase[i * 3 + 2] = z;
      dustPos[i * 3] = x;
      dustPos[i * 3 + 1] = y;
      dustPos[i * 3 + 2] = z;
      dustSeed[i] = Math.random() * 1000;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 0.022,
      color: 0x6a6ad0,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    scene.add(dust);

    const glowGeo = new THREE.SphereGeometry(0.9, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x241f3d, transparent: true, opacity: 0.55 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glow);

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
      const eased = Math.pow(progress, 1.5);

      const modeCount = reducedMotion ? 1 : 1 + eased * 10;
      const vibAmp = reducedMotion ? 0.015 : 0.02 + eased * 0.34;
      const fray = reducedMotion ? 0 : Math.pow(eased, 1.7) * 1.35;
      const outOfPlane = reducedMotion ? 0 : Math.pow(eased, 2) * 1.1;
      const speed = 0.55 + eased * 0.9;

      mouseLerped.x += (mouse.x - mouseLerped.x) * 0.03;
      mouseLerped.y += (mouse.y - mouseLerped.y) * 0.03;

      knots.forEach((k, ki) => {
        const { p, q, R, r, rot, hue } = k.def;
        const segs = k.def.segs;
        const breathe = 1 + Math.sin(t * 0.5 + k.phase) * 0.02;

        for (let i = 0; i < segs; i++) {
          const theta = (i / segs) * Math.PI * 2;
          const seed = Math.sin(i * 12.9898 + ki * 7.1) * 43758.5453 % 1;

          const ripple = Math.sin(modeCount * theta + t * speed + k.phase) * vibAmp;
          const rPrime = (r + ripple) * breathe;
          const wobble = fray * Math.sin(theta * 3 + k.phase + t * 0.3);
          const rho = R + wobble + rPrime * Math.cos(q * theta);

          let x0 = rho * Math.cos(p * theta);
          let y0 = rho * Math.sin(p * theta);
          let z0 =
            rPrime * Math.sin(q * theta) +
            outOfPlane * Math.sin(modeCount * 1.4 * theta - t * speed * 0.6 + seed * 6.28);

          const [x, y, z] = rotateVec(x0, y0, z0, rot[0], rot[1], rot[2]);
          k.core[i * 3] = x;
          k.core[i * 3 + 1] = y;
          k.core[i * 3 + 2] = z;

          const haloR = rho + 0.05 + fray * 0.4;
          let hx0 = haloR * Math.cos(p * theta);
          let hy0 = haloR * Math.sin(p * theta);
          let hz0 = z0 * 1.15;
          const [hx, hy, hz] = rotateVec(hx0, hy0, hz0, rot[0], rot[1], rot[2]);
          k.halo[i * 3] = hx;
          k.halo[i * 3 + 1] = hy;
          k.halo[i * 3 + 2] = hz;
        }
        k.coreGeo.attributes.position.needsUpdate = true;
        k.haloGeo.attributes.position.needsUpdate = true;

        const warm = cssLerp(hue, WARM_TARGET, eased * 0.85);
        k.coreMat.color.set(warm);
        k.haloMat.color.set(warm);
        k.coreMat.opacity = 0.7 + eased * 0.2;
        k.haloMat.opacity = 0.14 + eased * 0.18;
      });

      const dustArr = dustGeo.attributes.position.array;
      const jitter = 0.02 + eased * 0.55;
      for (let i = 0; i < DUST; i++) {
        const s = dustSeed[i];
        dustArr[i * 3] = dustBase[i * 3] + Math.sin(t * 0.6 + s) * jitter;
        dustArr[i * 3 + 1] = dustBase[i * 3 + 1] + Math.cos(t * 0.5 + s * 1.3) * jitter;
        dustArr[i * 3 + 2] = dustBase[i * 3 + 2] + Math.sin(t * 0.4 + s * 0.7) * jitter;
      }
      dustGeo.attributes.position.needsUpdate = true;
      dustMat.opacity = 0.16 + eased * 0.4;
      dustMat.color.set(hexLerp(0x6a6ad0, WARM_TARGET, eased * 0.7));

      const drift = reducedMotion ? 0 : t * 0.045;
      group.rotation.y = drift + progress * Math.PI * 0.5 + mouseLerped.x * 0.12;
      group.rotation.x = Math.sin(progress * Math.PI) * 0.2 + mouseLerped.y * 0.08;
      group.rotation.z = eased * Math.sin(t * 0.25) * 0.15;
      dust.rotation.copy(group.rotation);

      const shake = reducedMotion ? 0 : eased * 0.28;
      camera.position.z = 9.5 - progress * 6.5;
      camera.position.x = Math.sin(progress * Math.PI * 2) * 0.5 + Math.sin(t * 2.3) * shake + mouseLerped.x * 0.2;
      camera.position.y = Math.cos(t * 2.0) * shake * 0.5 + mouseLerped.y * 0.15;
      camera.fov = 56 + progress * 16;
      camera.updateProjectionMatrix();

      glow.material.opacity = 0.55 - progress * 0.38;
      glow.material.color.set(hexLerp(0x241f3d, 0x3d2018, eased));

      renderer.render(scene, camera);
    }
    animate();

    const ro = new ResizeObserver(setSize);
    ro.observe(mount);
    window.addEventListener("resize", setSize);
    window.addEventListener("orientationchange", setSize);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(rafSize);
      ro.disconnect();
      window.removeEventListener("resize", setSize);
      window.removeEventListener("orientationchange", setSize);
      window.removeEventListener("mousemove", onMouseMove);
      knots.forEach((k) => {
        k.coreGeo.dispose();
        k.haloGeo.dispose();
        k.coreMat.dispose();
        k.haloMat.dispose();
      });
      dustGeo.dispose();
      dustMat.dispose();
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
    <div ref={ref} style={{ opacity: revealed ? 1 : 0, transition: "opacity 0.7s ease-out" }}>
      <DistortText text={text} chaos={revealed ? restChaos : 1} style={style} reducedMotion={reducedMotion} />
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
  const isNarrow = useIsNarrow();

  useKnotField(mountRef, progressRef, reducedMotion);

  const scrollTo = useCallback((id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const grainSvg =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`
    );

  const vignetteInner = cssLerp(0x05060c, 0x0c0709, display);
  const vignetteOuter = cssLerp(0x05060c, 0x140a0a, display);

  return (
    <div
      className="pf-stage"
      style={{
        position: "fixed",
        inset: 0,
        background: "#05060c",
        overflow: "hidden",
        fontFamily: "'Söhne', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body, #root { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; overscroll-behavior: none; }
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500&family=Inter:wght@300;400;500;600&display=swap');
        .fr { font-family: 'Fraunces', serif; }
        .in { font-family: 'Inter', sans-serif; }
        ::selection { background: #7c6fff55; }
        .pf-stage canvas { display: block; }
        .scrollarea {
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-y: contain;
        }
        .scrollarea::-webkit-scrollbar { display: none; }
        .navdot { transition: background 0.3s, transform 0.3s; }
        @media (prefers-reduced-motion: reduce) {
          * { scroll-behavior: auto !important; animation: none !important; }
        }
        @supports (height: 100dvh) {
          .pf-stage { height: 100dvh; }
        }
      `}</style>

      <div ref={mountRef} style={{ position: "absolute", inset: 0, zIndex: 0 }} />

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

      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          pointerEvents: "none",
          background: `radial-gradient(ellipse at 50% 40%, transparent 0%, ${vignetteInner}dd 65%, ${vignetteOuter} 100%)`,
        }}
      />

      <div
        style={
          isNarrow
            ? {
                position: "absolute",
                left: "50%",
                bottom: "max(16px, env(safe-area-inset-bottom))",
                transform: "translateX(-50%)",
                zIndex: 4,
                display: "flex",
                flexDirection: "row",
                gap: "14px",
              }
            : {
                position: "absolute",
                right: "28px",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 4,
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }
        }
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
              transform: display >= i * 0.25 && display < (i + 1) * 0.25 ? "scale(1.7)" : "scale(1)",
            }}
          />
        ))}
      </div>

      <div
        ref={scrollRef}
        className="scrollarea"
        style={{
          position: "relative",
          zIndex: 3,
          height: "100%",
          width: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          scrollBehavior: "smooth",
        }}
      >
        <section
          id="hero"
          style={{
            minHeight: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: isNarrow ? "0 6vw" : "0 8vw",
            maxWidth: "900px",
          }}
        >
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
        </section>

        <section id="about" style={{ minHeight: "100%", display: "flex", alignItems: "center", padding: isNarrow ? "0 6vw" : "0 8vw" }}>
          <StoryLine
            text={LINE_TWO}
            restChaos={0.12}
            reducedMotion={reducedMotion}
            style={{ color: "#e8e6f0", fontSize: "clamp(1.6rem, 3.6vw, 2.8rem)", lineHeight: 1.4, fontWeight: 300, maxWidth: "640px" }}
          />
        </section>

        <section id="more" style={{ minHeight: "100%", display: "flex", alignItems: "center", padding: isNarrow ? "0 6vw" : "0 8vw" }}>
          <StoryLine
            text={LINE_THREE}
            restChaos={0.08}
            reducedMotion={reducedMotion}
            style={{ color: "#e8e6f0", fontSize: "clamp(1.6rem, 3.6vw, 2.8rem)", lineHeight: 1.4, fontWeight: 300, maxWidth: "640px" }}
          />
        </section>

        <section id="contact" style={{ minHeight: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: isNarrow ? "0 6vw" : "0 8vw", paddingBottom: isNarrow ? "72px" : 0 }}>
          <StoryLine
            text={DISPLAY_NAME}
            restChaos={0.05}
            reducedMotion={reducedMotion}
            style={{ color: "#f2f0f7", fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 500 }}
          />
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="fr"
            style={{
              display: "block",
              marginTop: "14px",
              color: "#f2f0f7",
              fontSize: "clamp(1.1rem, 2.2vw, 1.5rem)",
              fontWeight: 300,
              textDecoration: "none",
              wordBreak: "break-word",
            }}
          >
            {CONTACT_EMAIL}
          </a>
        </section>
      </div>
    </div>
  );
}