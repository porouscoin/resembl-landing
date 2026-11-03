'use client';

import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  r: number;
  baseOpacity: number;
  speed: number;
  phase: number;
  color: [number, number, number];
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  frame: number;
  maxFrames: number;
  isTeal: boolean;
}

export default function FuturisticHomeBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let animId = 0;
    let t = 0;
    let stars: Star[] = [];
    let shooters: ShootingStar[] = [];
    let spawnCooldown = 0;

    const STAR_COUNT = 240;

    const initStars = () => {
      stars = Array.from({ length: STAR_COUNT }, () => {
        const isTeal = Math.random() < 0.22;
        return {
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() * 1.3 + 0.15,
          baseOpacity: Math.random() * 0.55 + 0.2,
          speed: Math.random() * 0.45 + 0.15,
          phase: Math.random() * Math.PI * 2,
          color: isTeal
            ? [120, 230, 210] as [number, number, number]
            : [195 + (Math.random() * 40 | 0), 215 + (Math.random() * 25 | 0), 255] as [number, number, number],
        };
      });
    };

    const spawnShooter = () => {
      // Start along top edge or left edge
      const fromTop = Math.random() < 0.75;
      const angle = (Math.PI / 180) * (30 + Math.random() * 25); // 30–55° below horizontal
      const speed = 9 + Math.random() * 7; // 9–16 px/frame
      shooters.push({
        x: fromTop ? Math.random() * W * 0.85 : 0,
        y: fromTop ? Math.random() * H * 0.35 : Math.random() * H * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        len: 60 + Math.random() * 80,
        frame: 0,
        maxFrames: 45 + Math.floor(Math.random() * 25),
        isTeal: Math.random() < 0.3,
      });
    };

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.scale(dpr, dpr);
      initStars();
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      ctx.clearRect(0, 0, W, H);
      t += 0.008; // moderate twinkling speed

      // ── Stars ──
      for (const s of stars) {
        const twinkle = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.speed * 9 + s.phase));
        const opacity = s.baseOpacity * twinkle;
        const [r, g, b] = s.color;

        const glowR = s.r * 5;
        const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, glowR);
        grd.addColorStop(0, `rgba(${r},${g},${b},${(opacity * 0.35).toFixed(3)})`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.beginPath();
        ctx.arc(s.x, s.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, opacity * 1.6).toFixed(3)})`;
        ctx.fill();
      }

      // ── Spawn shooting stars ──
      spawnCooldown--;
      if (spawnCooldown <= 0) {
        spawnShooter();
        // Next spawn in 90–180 frames (~1.5–3 s at 60fps)
        spawnCooldown = 90 + Math.floor(Math.random() * 90);
      }

      // ── Draw & tick shooting stars ──
      shooters = shooters.filter((sh) => sh.frame < sh.maxFrames && sh.x < W + 200 && sh.y < H + 200);
      for (const sh of shooters) {
        const progress = sh.frame / sh.maxFrames;
        // Fade: ramp up quickly, then fade out
        const fade = progress < 0.15
          ? progress / 0.15
          : 1 - (progress - 0.15) / 0.85;
        const alpha = Math.max(0, fade);

        const tailX = sh.x - sh.vx * (sh.len / (Math.abs(sh.vx) + Math.abs(sh.vy)));
        const tailY = sh.y - sh.vy * (sh.len / (Math.abs(sh.vx) + Math.abs(sh.vy)));

        const [cr, cg, cb] = sh.isTeal ? [94, 234, 212] : [255, 255, 255];
        const grad = ctx.createLinearGradient(tailX, tailY, sh.x, sh.y);
        grad.addColorStop(0, `rgba(${cr},${cg},${cb},0)`);
        grad.addColorStop(0.6, `rgba(${cr},${cg},${cb},${(alpha * 0.45).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${cr},${cg},${cb},${alpha.toFixed(3)})`);

        ctx.save();
        ctx.strokeStyle = grad;
        ctx.lineWidth = sh.isTeal ? 1.2 : 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(sh.x, sh.y);
        ctx.stroke();

        // Bright head flare
        const flareGrd = ctx.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, 4);
        flareGrd.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha.toFixed(3)})`);
        flareGrd.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = flareGrd;
        ctx.beginPath();
        ctx.arc(sh.x, sh.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        sh.x += sh.vx;
        sh.y += sh.vy;
        sh.frame++;
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div className="futuristic-home-bg" aria-hidden="true">
      {/* Base gradient */}
      <div className="futuristic-home-base-gradient" />

      {/* Ambient glow blobs */}
      <div className="futuristic-home-glow futuristic-home-glow-1" />
      <div className="futuristic-home-glow futuristic-home-glow-2" />
      <div className="futuristic-home-glow futuristic-home-glow-3" />

      {/* Perspective grid */}
      <div className="futuristic-home-grid" />

      {/* Canvas star field — rendered on top */}
      <canvas ref={canvasRef} className="futuristic-home-canvas" />
    </div>
  );
}
