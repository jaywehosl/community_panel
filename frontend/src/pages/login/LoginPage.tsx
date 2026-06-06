import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  ConfigProvider,
  Form,
  Input,
  Layout,
  Menu,
  Popover,
  Space,
  Spin,
  message,
} from 'antd';
import {
  KeyOutlined,
  LockOutlined,
  MoonFilled,
  MoonOutlined,
  SunOutlined,
  TranslationOutlined,
  UserOutlined,
} from '@ant-design/icons';

import { HttpUtil, LanguageManager } from '@/utils';
import { antdRule } from '@/utils/zodForm';
import { setMessageInstance } from '@/utils/messageBus';
import { pauseAnimationsUntilLeave, useTheme } from '@/hooks/useTheme';
import { LoginFormSchema, TwoFactorCodeSchema, type LoginFormValues } from '@/schemas/login';
import './LoginPage.css';

const HEADLINE_INTERVAL_MS = 2000;

type LoginForm = LoginFormValues;

const basePath = window.X_UI_BASE_PATH || '';

export default function LoginPage() {
  const { t } = useTranslation();
  const { isDark, isUltra, toggleTheme, toggleUltra, antdThemeConfig } = useTheme();
  const [messageApi, messageContextHolder] = message.useMessage();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setMessageInstance(messageApi);
  }, [messageApi]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    let mouse = { x: width / 2, y: height / 2, tx: width / 2, ty: height / 2 };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.tx = e.clientX;
      mouse.ty = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    class Particle {
      x: number = Math.random() * width;
      y: number = Math.random() * height;
      vx: number = (Math.random() - 0.5) * 0.3;
      vy: number = (Math.random() - 0.5) * 0.3;
      size: number = Math.random() * 80 + 60; // Large organic glowing blobs
      // Google Red (#EA4335) or Google Blue (#4285F4) with soft transparency
      color: string = Math.random() > 0.5 ? 'rgba(66, 133, 244, 0.12)' : 'rgba(234, 67, 53, 0.10)';

      update() {
        this.x += this.vx;
        this.y += this.vy;

        // Bounce/loop at margins
        if (this.x < -150) this.x = width + 150;
        if (this.x > width + 150) this.x = -150;
        if (this.y < -150) this.y = height + 150;
        if (this.y > height + 150) this.y = -150;

        // Mouse follow behavior
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 400) {
          const force = (400 - dist) / 4000;
          this.vx += (dx / dist) * force * 0.2;
          this.vy += (dy / dist) * force * 0.2;
        }

        // Limit speed
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > 1.5) {
          this.vx = (this.vx / speed) * 1.5;
          this.vy = (this.vy / speed) * 1.5;
        }
      }

      draw(c: CanvasRenderingContext2D) {
        c.beginPath();
        const grad = c.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
        grad.addColorStop(0, this.color);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        c.fillStyle = grad;
        c.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        c.fill();
      }
    }

    const particles: Particle[] = [];
    const count = Math.min(24, Math.floor((width * height) / 40000));
    for (let i = 0; i < count; i++) {
      particles.push(new Particle());
    }

    const render = () => {
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;

      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.update();
        p.draw(ctx);
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, []);

  const [fetched, setFetched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [twoFactorEnable, setTwoFactorEnable] = useState(false);
  const [lang, setLang] = useState<string>(() => LanguageManager.getLanguage());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const msg = await HttpUtil.post('/getTwoFactorEnable');
      if (cancelled) return;
      if (msg.success) setTwoFactorEnable(!!msg.obj);
      setFetched(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const onSubmit = useCallback(async (values: LoginForm) => {
    setSubmitting(true);
    try {
      const msg = await HttpUtil.post('/login', values);
      if (msg.success) window.location.href = basePath + 'panel/';
    } finally {
      setSubmitting(false);
    }
  }, []);

  const onLangChange = useCallback((next: string) => {
    setLang(next);
    LanguageManager.setLanguage(next);
  }, []);

  const cycleTheme = useCallback(() => {
    pauseAnimationsUntilLeave('login-theme-cycle');
    if (!isDark) {
      toggleTheme();
      if (isUltra) toggleUltra();
    } else if (!isUltra) {
      toggleUltra();
    } else {
      toggleUltra();
      toggleTheme();
    }
  }, [isDark, isUltra, toggleTheme, toggleUltra]);

  const pageClass = useMemo(() => {
    const classes = ['login-app'];
    if (isDark) classes.push('is-dark');
    if (isUltra) classes.push('is-ultra');
    return classes.join(' ');
  }, [isDark, isUltra]);

  const langMenuItems = useMemo(
    () => (LanguageManager.supportedLanguages as { value: string; name: string; icon: string }[]).map((l) => ({
      key: l.value,
      label: (
        <Space size={8}>
          <span aria-hidden="true">{l.icon}</span>
          <span>{l.name}</span>
        </Space>
      ),
    })),
    [],
  );

  const themeIcon = !isDark ? <SunOutlined /> : !isUltra ? <MoonOutlined /> : <MoonFilled />;

  return (
    <ConfigProvider theme={antdThemeConfig}>
      {messageContextHolder}
      <Layout className={pageClass}>
        <canvas ref={canvasRef} className="kinetic-canvas" />
        <Layout.Content className="login-content">
          <div className="login-header">
            <div className="brand-block">
              <svg className="antigravity-logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 24, height: 24, marginRight: 8 }}>
                <path d="M12 2L2 22h20L12 2z" fill="#3279F9" />
                <path d="M12 6l7 13H5l7-13z" fill="#FFFFFF" opacity="0.3" />
              </svg>
              <span className="brand-text">3X-UI Antigravity</span>
            </div>
            <div className="login-header-right">
              <Button
                id="login-theme-cycle"
                shape="circle"
                size="large"
                className="toolbar-btn"
                aria-label={t('menu.theme')}
                title={t('menu.theme')}
                icon={themeIcon}
                onClick={cycleTheme}
              />
              <Popover
                rootClassName={isDark ? 'dark' : 'light'}
                placement="bottomRight"
                trigger="click"
                styles={{ content: { padding: 4 } }}
                content={
                  <Menu
                    mode="vertical"
                    selectable
                    selectedKeys={[lang]}
                    items={langMenuItems}
                    onClick={({ key }) => onLangChange(key)}
                    style={{ border: 'none', minWidth: 160 }}
                  />
                }
              >
                <Button
                  shape="circle"
                  size="large"
                  className="toolbar-btn"
                  aria-label={t('pages.settings.language')}
                  icon={<TranslationOutlined />}
                />
              </Popover>
            </div>
          </div>

          <div className="login-hero-container">
            <h1 className="login-hero-title">
              Experience liftoff with next-gen connection management
            </h1>
            <p className="login-hero-subtitle">
              A clean, spacious, and high-performance panel powered by Xray-core.
            </p>
          </div>

          <div className="login-wrapper">
            {!fetched ? (
              <div className="login-loading">
                <Spin size="large" />
              </div>
            ) : (
              <div className="login-card">
                <Form
                  layout="vertical"
                  className="login-form"
                  onFinish={onSubmit}
                  initialValues={{ username: '', password: '', twoFactorCode: '' }}
                >
                  <Form.Item
                    label={t('username')}
                    name="username"
                    rules={[antdRule(LoginFormSchema.shape.username, t)]}
                  >
                    <Input
                      prefix={<UserOutlined style={{ color: '#3279F9' }} />}
                      autoComplete="username"
                      size="large"
                      placeholder={t('username')}
                      autoFocus
                    />
                  </Form.Item>

                  <Form.Item
                    label={t('password')}
                    name="password"
                    rules={[antdRule(LoginFormSchema.shape.password, t)]}
                  >
                    <Input.Password
                      prefix={<LockOutlined style={{ color: '#3279F9' }} />}
                      autoComplete="current-password"
                      size="large"
                      placeholder={t('password')}
                    />
                  </Form.Item>

                  {twoFactorEnable && (
                    <Form.Item
                      label={t('twoFactorCode')}
                      name="twoFactorCode"
                      rules={[antdRule(TwoFactorCodeSchema, t)]}
                    >
                      <Input
                        prefix={<KeyOutlined style={{ color: '#3279F9' }} />}
                        autoComplete="one-time-code"
                        size="large"
                        placeholder={t('twoFactorCode')}
                      />
                    </Form.Item>
                  )}

                  <Form.Item className="submit-row">
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={submitting}
                      size="large"
                      block
                      className="login-submit-btn"
                    >
                      {t('login')}
                    </Button>
                  </Form.Item>
                </Form>
              </div>
            )}
          </div>
        </Layout.Content>
      </Layout>
    </ConfigProvider>
  );
}
