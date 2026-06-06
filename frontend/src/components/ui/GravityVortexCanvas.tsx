import { useEffect, useRef } from 'react';
import { useTheme } from '@/hooks/useTheme';

export default function GravityVortexCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Track mouse coordinate globally relative to viewport
    let mouseX = -1000;
    let mouseY = -1000;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };
    window.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseleave', handleMouseLeave);

    class Particle {
      angle: number;
      radius: number;
      baseRadius: number;
      speed: number;
      size: number;
      color: string;
      prevX: number = 0;
      prevY: number = 0;
      waveSpeed: number;
      waveAmplitude: number;

      constructor() {
        this.angle = Math.random() * Math.PI * 2;
        // Radial distribution matching a donut/vortex field
        this.baseRadius = Math.random() * 320 + 80;
        this.radius = this.baseRadius;
        
        // Cohesive flow direction: all rotate clockwise
        this.speed = Math.random() * 0.003 + 0.0012;
        this.size = Math.random() * 1.6 + 0.7;
        
        // Wave properties for organic perturbations
        this.waveSpeed = Math.random() * 0.02 + 0.01;
        this.waveAmplitude = Math.random() * 20 + 6;

        // Group colors by angle sectors for a smooth rainbow gradient circle
        const angleDeg = (this.angle * 180) / Math.PI;
        if (angleDeg < 72) {
          this.color = 'rgba(251, 188, 5, '; // Google Yellow
        } else if (angleDeg < 144) {
          this.color = 'rgba(52, 168, 83, '; // Google Green
        } else if (angleDeg < 216) {
          this.color = 'rgba(66, 133, 244, '; // Google Blue
        } else if (angleDeg < 288) {
          this.color = 'rgba(168, 85, 247, '; // Indigo/Purple
        } else {
          this.color = 'rgba(234, 67, 53, '; // Google Red
        }
      }

      update(cx: number, cy: number, mX: number, mY: number, time: number) {
        this.angle += this.speed;

        // Generate fluid wave-like offsets to make orbits organic and wavy
        const wave = Math.sin(this.angle * 3.5 + time * this.waveSpeed * 12) * this.waveAmplitude;
        const currentRadius = this.baseRadius + wave;

        // Theoretical coordinate in screen-centered orbit
        let tx = cx + Math.cos(this.angle) * currentRadius;
        let ty = cy + Math.sin(this.angle) * currentRadius;

        // Mouse interactive force field
        if (mX > -500 && mY > -500) {
          const dx = tx - mX;
          const dy = ty - mY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const activeRadius = 200; // Hover influence range

          if (dist < activeRadius) {
            const ndx = dx / (dist || 1);
            const ndy = dy / (dist || 1);
            
            // Interaction strength decay curve
            const force = Math.pow((activeRadius - dist) / activeRadius, 1.6);

            // Repulsion: push particles away from the cursor
            tx += ndx * force * 65;
            ty += ndy * force * 65;

            // Swirl drag: pull particles around the cursor in a mini-cyclone
            tx += -ndy * force * 45;
            ty += ndx * force * 45;
          }
        }

        if (this.prevX === 0) {
          this.prevX = tx;
          this.prevY = ty;
        } else {
          // Smooth interpolation of trails
          this.prevX = this.prevX + (tx - this.prevX) * 0.24;
          this.prevY = this.prevY + (ty - this.prevY) * 0.24;
        }

        return { x: tx, y: ty };
      }

      draw(c: CanvasRenderingContext2D, x: number, y: number, dark: boolean) {
        c.beginPath();
        c.moveTo(this.prevX, this.prevY);
        c.lineTo(x, y);

        const alpha = dark ? '0.35' : '0.5';
        c.strokeStyle = this.color + alpha + ')';
        c.lineWidth = this.size;
        c.lineCap = 'round';
        c.stroke();

        this.prevX = x;
        this.prevY = y;
      }
    }

    const particles: Particle[] = [];
    const count = Math.min(650, Math.floor((width * height) / 3000));
    for (let i = 0; i < count; i++) {
      particles.push(new Particle());
    }

    let animationId: number;
    let time = 0;

    const render = () => {
      time += 0.1;
      ctx.clearRect(0, 0, width, height);

      // Center the gravity vortex at the middle of the viewport
      const cx = width / 2;
      const cy = height / 2;

      particles.forEach((p) => {
        const pos = p.update(cx, cy, mouseX, mouseY, time);
        p.draw(ctx, pos.x, pos.y, isDark);
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationId);
    };
  }, [isDark]);

  return <canvas ref={canvasRef} className="antigravity-canvas" />;
}
