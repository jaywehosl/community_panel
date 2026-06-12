import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card, Divider, Segmented, Select, Switch } from '@/components/ds';
import { toast } from '@/components/ds';
import { applyTheme, applyThemeMode, type PanelTheme, type ThemeMode } from '@/theme/themeApply';
import { clearTheme, fetchServerTheme, loadTheme, saveTheme, uploadThemeAsset } from '@/theme/themeStorage';
import './AppearancePage.css';

/* NOTE: this is the P1 Appearance page. Controls drive the override core
 * (themeApply) live; persistence is the localStorage placeholder for now —
 * slab 3 swaps it for the server `panelTheme` setting. Knobs marked "soon"
 * are placeholders whose tokens are not yet expanded in the core (shadows /
 * effects); they're here so we can see the full surface and wire it next. */

const FONT_OPTIONS = [
  { label: 'Plus Jakarta Sans', value: "'Plus Jakarta Sans', sans-serif" },
  { label: 'Outfit', value: "'Outfit', sans-serif" },
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'System UI', value: 'system-ui, -apple-system, sans-serif' },
];
const MONO_OPTIONS = [
  { label: 'Fira Code', value: "'Fira Code', monospace" },
  { label: 'JetBrains Mono', value: "'JetBrains Mono', monospace" },
  { label: 'System Mono', value: 'ui-monospace, Menlo, monospace' },
];

function hexToRgb(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function getLuminance(hex: string): number {
  const cleanHex = hex.replace('#', '').trim();
  const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
  const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
  const b = parseInt(cleanHex.slice(4, 6), 16) / 255;
  
  const a = [r, g, b].map((v) => {
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const PRESETS = [
  {
    name: 'Antigravity Default',
    theme: {
      mode: 'light' as ThemeMode,
      tokens: {
        '--color-primary': '#3279f9',
        '--color-primary-rgb': '50, 121, 249',
        '--color-success': '#34a853',
        '--color-warning': '#f5a524',
        '--color-error': '#ea4335',
        '--glass-blur': '30px',
        '--glass-saturate': '170%',
        '--radius-scale': 1.0,
        '--shadow-intensity': 1.0,
      },
      background: { type: 'aura' },
      fonts: {
        sans: "'Plus Jakarta Sans', sans-serif",
        display: "'Outfit', sans-serif",
        mono: "'Fira Code', monospace",
      },
      effects: {
        particles: { on: true, density: 1.0, speed: 1.0, color: 'palette' },
        hoverGlow: true,
      },
    },
  },
  {
    name: 'Deep Space',
    theme: {
      mode: 'ultra-dark' as ThemeMode,
      tokens: {
        '--color-primary': '#a855f7',
        '--color-primary-rgb': '168, 85, 247',
        '--color-success': '#10b981',
        '--color-warning': '#fbbf24',
        '--color-error': '#ef4444',
        '--glass-blur': '40px',
        '--glass-saturate': '200%',
        '--radius-scale': 1.2,
        '--shadow-intensity': 1.5,
      },
      background: { type: 'aura' },
      fonts: {
        sans: "'Plus Jakarta Sans', sans-serif",
        display: "'Outfit', sans-serif",
        mono: "'Fira Code', monospace",
      },
      effects: {
        particles: { on: true, density: 1.5, speed: 1.2, color: 'primary' },
        hoverGlow: true,
      },
    },
  },
  {
    name: 'Nordic Frosted',
    theme: {
      mode: 'light' as ThemeMode,
      tokens: {
        '--color-primary': '#14b8a6',
        '--color-primary-rgb': '20, 184, 166',
        '--color-success': '#10b981',
        '--color-warning': '#f59e0b',
        '--color-error': '#ef4444',
        '--glass-blur': '20px',
        '--glass-saturate': '130%',
        '--radius-scale': 0.8,
        '--shadow-intensity': 0.5,
      },
      background: { type: 'color', color: '#f0f4f8' },
      fonts: {
        sans: "'Inter', sans-serif",
        display: "'Outfit', sans-serif",
        mono: "ui-monospace, Menlo, monospace",
      },
      effects: {
        particles: { on: false },
        hoverGlow: false,
      },
    },
  },
  {
    name: 'Cyberpunk Neon',
    theme: {
      mode: 'dark' as ThemeMode,
      tokens: {
        '--color-primary': '#ff007f',
        '--color-primary-rgb': '255, 0, 127',
        '--color-success': '#00ffcc',
        '--color-warning': '#ffff00',
        '--color-error': '#ff3333',
        '--glass-blur': '15px',
        '--glass-saturate': '180%',
        '--radius-scale': 1.1,
        '--shadow-intensity': 1.2,
      },
      background: { type: 'aura' },
      fonts: {
        sans: "'Outfit', sans-serif",
        display: "'Outfit', sans-serif",
        mono: "'Fira Code', monospace",
      },
      effects: {
        particles: { on: true, density: 1.8, speed: 1.5, color: 'palette' },
        hoverGlow: true,
      },
    },
  },
  {
    name: 'Emerald Glass',
    theme: {
      mode: 'dark' as ThemeMode,
      tokens: {
        '--color-primary': '#10b981',
        '--color-primary-rgb': '16, 185, 129',
        '--color-success': '#34d399',
        '--color-warning': '#fbbf24',
        '--color-error': '#f87171',
        '--glass-blur': '45px',
        '--glass-saturate': '190%',
        '--radius-scale': 1.3,
        '--shadow-intensity': 1.1,
      },
      background: { type: 'aura' },
      fonts: {
        sans: "'Plus Jakarta Sans', sans-serif",
        display: "'Outfit', sans-serif",
        mono: "'JetBrains Mono', monospace",
      },
      effects: {
        particles: { on: true, density: 0.9, speed: 0.8, color: 'monochrome' },
        hoverGlow: true,
      },
    },
  },
];

interface RowProps { label: string; hint?: string; soon?: boolean; children: React.ReactNode }
function Row({ label, hint, soon, children }: RowProps) {
  return (
    <div className="ap-row">
      <div className="ap-row-label">
        <span>{label}{soon && <span className="ap-soon">soon</span>}</span>
        {hint && <span className="ap-row-hint">{hint}</span>}
      </div>
      <div className="ap-row-control">{children}</div>
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Row label={label}>
      <span className="ap-color">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        <code>{value}</code>
      </span>
    </Row>
  );
}

function RangeRow({ label, min, max, step, value, suffix, soon, onChange }:
  { label: string; min: number; max: number; step: number; value: number; suffix?: string; soon?: boolean; onChange: (v: number) => void }) {
  return (
    <Row label={label} soon={soon}>
      <span className="ap-range">
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
        <code>{value}{suffix}</code>
      </span>
    </Row>
  );
}

const DEFAULTS = {
  primary: '#3279f9', success: '#34a853', warning: '#f5a524', error: '#ea4335',
  glassBlur: 30, glassSaturate: 170, radiusScale: 1, shadowIntensity: 1,
  bgColor: '#eaeefb', bgDim: 0.35, bgBlur: 0,
};

export default function AppearancePage() {
  const [theme, setTheme] = useState<PanelTheme>(() => loadTheme());
  const fileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  const fontFileRef = useRef<HTMLInputElement>(null);
  const [uploadingFont, setUploadingFont] = useState(false);

  // Prefer the server copy once it loads (falls back to the local cache).
  useEffect(() => {
    let alive = true;
    void fetchServerTheme().then((srv) => {
      if (alive && srv && Object.keys(srv).length) {
        setTheme(srv);
        applyTheme(srv);
        if (srv.mode) applyThemeMode(srv.mode);
      }
    });
    return () => { alive = false; };
  }, []);

  // mutate + apply live
  const patch = useCallback((updater: (t: PanelTheme) => PanelTheme) => {
    setTheme((prev) => {
      const next = updater(structuredClone(prev));
      applyTheme(next);
      if (next.mode) applyThemeMode(next.mode);
      return next;
    });
  }, []);

  const setToken = (k: string, v: string | number) =>
    patch((t) => ({ ...t, tokens: { ...t.tokens, [k]: v } }));
  const setPrimary = (hex: string) =>
    patch((t) => ({ ...t, tokens: { ...t.tokens, '--color-primary': hex, '--color-primary-rgb': hexToRgb(hex) ?? '' } }));
  const tok = (k: string, d: number | string) => (theme.tokens?.[k] ?? d);
  const num = (k: string, d: number) => {
    const raw = theme.tokens?.[k];
    if (raw === undefined || raw === null || raw === '') return d;
    const parsed = parseFloat(String(raw));
    return Number.isNaN(parsed) ? d : parsed;
  };

  const onSave = async () => {
    const ok = await saveTheme(theme);
    if (ok) toast.success('Theme saved');
    else toast.success('Saved locally (backend not reachable)');
  };
  const onReset = () => {
    clearTheme(); setTheme({}); applyTheme({}); applyThemeMode('light');
    void saveTheme({});
    toast.success('Reset to defaults');
  };
  const onExport = () => {
    const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'panel-theme.json'; a.click();
    URL.revokeObjectURL(url);
  };
  const onImport = (file: File) => {
    file.text().then((txt) => {
      try { const t = JSON.parse(txt) as PanelTheme; setTheme(t); applyTheme(t); if (t.mode) applyThemeMode(t.mode); toast.success('Theme imported'); }
      catch { toast.error('Invalid theme file'); }
    });
  };

  const onBgUpload = async (file: File) => {
    setUploadingBg(true);
    const id = await uploadThemeAsset('image', file);
    setUploadingBg(false);
    if (id) {
      patch((t) => ({ ...t, background: { ...t.background, type: 'image', assetId: id } }));
      toast.success('Background uploaded');
    } else {
      toast.error('Upload failed (backend not reachable?)');
    }
  };

  const onFontUpload = async (file: File) => {
    setUploadingFont(true);
    const id = await uploadThemeAsset('font', file);
    setUploadingFont(false);
    if (id) {
      patch((t) => ({ ...t, fonts: { ...t.fonts, sans: `asset:${id}` } }));
      toast.success('Font uploaded (applied to Sans)');
    } else {
      toast.error('Upload failed (backend not reachable?)');
    }
  };

  const bg = theme.background ?? {};
  const customFont = theme.fonts?.sans?.startsWith('asset:') ?? false;

  const getPageBgColor = () => {
    if (theme.background?.type === 'color' && theme.background.color) {
      return theme.background.color;
    }
    return theme.mode === 'light' ? '#eaeefb' : '#0a0b0f';
  };

  const primaryHex = String(tok('--color-primary', DEFAULTS.primary));
  const bgHex = getPageBgColor();
  const contrastRatio = getContrastRatio(primaryHex, bgHex);
  const isContrastLow = contrastRatio < 3.0;

  const densityVal = theme.effects?.particles?.density ?? 1.0;
  const isParticlesOn = theme.effects?.particles?.on !== false;


  return (
    <div className="appearance-page">
      <div className="ap-head">
        <div>
          <h1>Appearance</h1>
          <p>Customize the look of the panel. Changes preview live; Save to keep them.</p>
        </div>
        <div className="ap-actions">
          <Button onClick={onExport}>Export</Button>
          <Button onClick={() => fileRef.current?.click()}>Import</Button>
          <Button onClick={onReset}>Reset</Button>
          <Button variant="primary" onClick={onSave}>Save</Button>
          <input ref={fileRef} type="file" accept="application/json" hidden
            onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
        </div>
      </div>

      <div className="ap-grid">
        <Card title="Presets" className="ap-presets-card">
          <div className="ap-presets-list">
            {PRESETS.map((p) => (
              <Button
                key={p.name}
                size="sm"
                onClick={() => {
                  setTheme(p.theme as PanelTheme);
                  applyTheme(p.theme as PanelTheme);
                  if (p.theme.mode) applyThemeMode(p.theme.mode);
                  toast.success(`Preset "${p.name}" applied`);
                }}
              >
                {p.name}
              </Button>
            ))}
          </div>
        </Card>

        <Card title="Mode">
          <Row label="Color scheme" hint="Light / dark base from the design tokens">
            <Segmented
              value={theme.mode ?? 'light'}
              onChange={(v) => patch((t) => ({ ...t, mode: v as ThemeMode }))}
              options={[
                { label: 'Light', value: 'light' },
                { label: 'Dark', value: 'dark' },
                { label: 'Ultra dark', value: 'ultra-dark' },
              ]}
            />
          </Row>
        </Card>

        <Card title="Palette">
          <ColorRow label="Primary" value={primaryHex} onChange={setPrimary} />
          <div className="ap-contrast-indicator">
            <span>Contrast Ratio: <strong>{contrastRatio.toFixed(1)}:1</strong></span>
            {isContrastLow && (
              <span className="ap-warning-pill">
                ⚠️ Low Contrast
              </span>
            )}
          </div>
          <ColorRow label="Success" value={String(tok('--color-success', DEFAULTS.success))} onChange={(v) => setToken('--color-success', v)} />
          <ColorRow label="Warning" value={String(tok('--color-warning', DEFAULTS.warning))} onChange={(v) => setToken('--color-warning', v)} />
          <ColorRow label="Error" value={String(tok('--color-error', DEFAULTS.error))} onChange={(v) => setToken('--color-error', v)} />
        </Card>

        <Card title="Background">
          <Row label="Type">
            <Segmented
              value={bg.type ?? 'aura'}
              onChange={(v) => patch((t) => ({ ...t, background: { ...t.background, type: v as 'aura' | 'color' | 'image' } }))}
              options={[
                { label: 'Aura', value: 'aura' },
                { label: 'Solid', value: 'color' },
                { label: 'Image', value: 'image' },
              ]}
            />
          </Row>
          {bg.type === 'color' && (
            <ColorRow label="Page color" value={bg.color ?? DEFAULTS.bgColor}
              onChange={(v) => patch((t) => ({ ...t, background: { ...t.background, color: v } }))} />
          )}
          {bg.type === 'image' && (
            <Row label="Image" hint={bg.assetId ? 'Uploaded ✓' : 'PNG / JPG / WebP, up to 5 MB'}>
              <span className="ap-bg-upload">
                {bg.assetId && (
                  <Button size="sm" variant="text" danger
                    onClick={() => patch((t) => ({ ...t, background: { ...t.background, assetId: undefined } }))}>
                    Remove
                  </Button>
                )}
                <Button size="sm" loading={uploadingBg} onClick={() => bgFileRef.current?.click()}>
                  {bg.assetId ? 'Replace…' : 'Upload image…'}
                </Button>
                <input ref={bgFileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden
                  onChange={(e) => e.target.files?.[0] && onBgUpload(e.target.files[0])} />
              </span>
            </Row>
          )}
          <RangeRow label="Image dim" min={0} max={1} step={0.05} value={bg.dim ?? DEFAULTS.bgDim}
            onChange={(v) => patch((t) => ({ ...t, background: { ...t.background, dim: v } }))} />
          <RangeRow label="Image blur" min={0} max={40} step={1} value={bg.blur ? parseInt(bg.blur, 10) : DEFAULTS.bgBlur} suffix="px"
            onChange={(v) => patch((t) => ({ ...t, background: { ...t.background, blur: `${v}px` } }))} />
        </Card>

        <Card title="Glass & blur">
          <RangeRow label="Frost blur" min={0} max={60} step={2} suffix="px"
            value={num('--glass-blur', DEFAULTS.glassBlur)}
            onChange={(v) => setToken('--glass-blur', `${v}px`)} />
          <RangeRow label="Saturation" min={100} max={220} step={5} suffix="%"
            value={num('--glass-saturate', DEFAULTS.glassSaturate)}
            onChange={(v) => setToken('--glass-saturate', `${v}%`)} />
        </Card>

        <Card title="Shape & depth">
          <RangeRow label="Corner radius" min={0.5} max={2} step={0.1} suffix="×"
            value={num('--radius-scale', DEFAULTS.radiusScale)}
            onChange={(v) => setToken('--radius-scale', v)} />
          <RangeRow label="Shadow intensity" min={0} max={2} step={0.1} suffix="×"
            value={num('--shadow-intensity', DEFAULTS.shadowIntensity)}
            onChange={(v) => setToken('--shadow-intensity', v)} />
        </Card>

        <Card title="Typography">
          <Row label="Sans">
            <Select value={theme.fonts?.sans ?? FONT_OPTIONS[0].value}
              onChange={(v) => patch((t) => ({ ...t, fonts: { ...t.fonts, sans: String(v) } }))}
              options={FONT_OPTIONS} />
          </Row>
          <Row label="Display">
            <Select value={theme.fonts?.display ?? FONT_OPTIONS[1].value}
              onChange={(v) => patch((t) => ({ ...t, fonts: { ...t.fonts, display: String(v) } }))}
              options={FONT_OPTIONS} />
          </Row>
          <Row label="Mono">
            <Select value={theme.fonts?.mono ?? MONO_OPTIONS[0].value}
              onChange={(v) => patch((t) => ({ ...t, fonts: { ...t.fonts, mono: String(v) } }))}
              options={MONO_OPTIONS} />
          </Row>
          <Divider />
          <Row label="Custom font" hint={customFont ? 'Uploaded ✓ — applied to Sans' : 'woff2 / woff / ttf / otf, up to 3 MB'}>
            <span className="ap-bg-upload">
              {customFont && (
                <Button size="sm" variant="text" danger
                  onClick={() => patch((t) => ({ ...t, fonts: { ...t.fonts, sans: undefined } }))}>
                  Remove
                </Button>
              )}
              <Button size="sm" loading={uploadingFont} onClick={() => fontFileRef.current?.click()}>
                Upload font…
              </Button>
              <input ref={fontFileRef} type="file" accept=".woff2,.woff,.ttf,.otf" hidden
                onChange={(e) => e.target.files?.[0] && onFontUpload(e.target.files[0])} />
            </span>
          </Row>
        </Card>

        <Card title="Effects">
          <Row label="Particle field" hint="Interactive background particle field">
            <Switch
              checked={isParticlesOn}
              onChange={(c) => patch((t) => ({
                ...t,
                effects: {
                  ...t.effects,
                  particles: {
                    ...t.effects?.particles,
                    on: c,
                  },
                },
              }))}
            />
          </Row>
          {isParticlesOn && (
            <>
              <RangeRow
                label="Particle density"
                min={0.1}
                max={2.0}
                step={0.1}
                value={densityVal}
                suffix="×"
                onChange={(v) => patch((t) => ({
                  ...t,
                  effects: {
                    ...t.effects,
                    particles: {
                      ...t.effects?.particles,
                      density: v,
                    },
                  },
                }))}
              />
              <RangeRow
                label="Particle speed"
                min={0.1}
                max={2.0}
                step={0.1}
                value={theme.effects?.particles?.speed ?? 1.0}
                suffix="×"
                onChange={(v) => patch((t) => ({
                  ...t,
                  effects: {
                    ...t.effects,
                    particles: {
                      ...t.effects?.particles,
                      speed: v,
                    },
                  },
                }))}
              />
              <Row label="Particle color" hint="Theme accent or multicolor mix">
                <Select
                  value={theme.effects?.particles?.color ?? 'palette'}
                  onChange={(v) => patch((t) => ({
                    ...t,
                    effects: {
                      ...t.effects,
                      particles: {
                        ...t.effects?.particles,
                        color: v as 'primary' | 'monochrome' | 'palette',
                      },
                    },
                  }))}
                  options={[
                    { label: 'Multicolor Accent Mix', value: 'palette' },
                    { label: 'Primary Accent Only', value: 'primary' },
                    { label: 'Monochrome Palette', value: 'monochrome' },
                  ]}
                />
              </Row>
              <Row label="Particle style" hint="Visual movement and preset type">
                <Select
                  value={theme.effects?.particles?.preset ?? 'pucks'}
                  onChange={(v) => patch((t) => ({
                    ...t,
                    effects: {
                      ...t.effects,
                      particles: {
                        ...t.effects?.particles,
                        preset: v as 'pucks' | 'neural' | 'nebula',
                      },
                    },
                  }))}
                  options={[
                    { label: 'Air Hockey Pucks', value: 'pucks' },
                    { label: 'Neural Constellation', value: 'neural' },
                    { label: 'Nebula Gravity Vortex', value: 'nebula' },
                  ]}
                />
              </Row>
            </>
          )}
          <Row label="Hover glow" hint="Glow highlight on buttons and cards hover">
            <Switch
              checked={theme.effects?.hoverGlow !== false}
              onChange={(c) => patch((t) => ({
                ...t,
                effects: {
                  ...t.effects,
                  hoverGlow: c,
                },
              }))}
            />
          </Row>

        </Card>
      </div>
    </div>
  );
}
