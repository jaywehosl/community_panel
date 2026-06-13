import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ComponentType } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BellOutlined,
  CloseOutlined,
  MenuOutlined,
  MoonFilled,
  MoonOutlined,
  SunOutlined,
  TranslationOutlined,
} from '@ant-design/icons';
import { Button, DropdownMenu } from '@/components/ds';
import type { MenuEntry } from '@/components/ds';

import { useMetricsPanel } from '@/layouts/MetricsPanelContext';
import { useNotifications } from '@/pages/index/useNotifications';
import { subscribe as notifSubscribe, getSnapshot as notifSnapshot } from '@/stores/notificationStore';
import { useHeaderActions } from '@/layouts/header-actions-context';
import { HttpUtil, LanguageManager } from '@/utils';
import { useTheme } from '@/hooks/useTheme';
import {
  DashboardIcon,
  InboundsIcon,
  ClientsIcon,
  GroupsIcon,
  NodesIcon,
  SettingsIcon,
  XrayIcon,
  ApiDocsIcon,
  LogoutIcon,
} from '@/components/ui';
import './AppSidebar.css';

const LOGOUT_KEY = '__logout__';

type IconName = 'dashboard' | 'inbound' | 'team' | 'groups' | 'setting' | 'tool' | 'cluster' | 'logout' | 'apidocs';

const iconByName: Record<IconName, ComponentType<any>> = {
  dashboard: DashboardIcon,
  inbound: InboundsIcon,
  team: ClientsIcon,
  groups: GroupsIcon,
  setting: SettingsIcon,
  tool: XrayIcon,
  cluster: NodesIcon,
  logout: LogoutIcon,
  apidocs: ApiDocsIcon,
};

function ThemeCycleButton({ id, isDark, isUltra, onCycle, ariaLabel }: {
  id: string;
  isDark: boolean;
  isUltra: boolean;
  onCycle: () => void;
  ariaLabel: string;
}) {
  const icon = !isDark ? <SunOutlined /> : !isUltra ? <MoonOutlined /> : <MoonFilled />;
  return (
    <button
      id={id}
      type="button"
      className="sidebar-theme-cycle"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onCycle}
    >
      {icon}
    </button>
  );
}

function LanguageSelector() {
  const { t } = useTranslation();
  const [lang, setLang] = useState<string>(() => LanguageManager.getLanguage());
  const items = useMemo<MenuEntry[]>(
    () => (LanguageManager.supportedLanguages as { value: string; name: string; icon: string }[]).map((l) => ({
      key: l.value,
      selected: l.value === lang,
      label: (
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <span aria-hidden="true">{l.icon}</span>
          <span>{l.name}</span>
        </span>
      ),
      onSelect: () => { setLang(l.value); LanguageManager.setLanguage(l.value); },
    })),
    [lang],
  );
  return (
    <DropdownMenu
      align="end"
      items={items}
      trigger={(
        <button
          type="button"
          className="sidebar-theme-cycle"
          aria-label={t('pages.settings.language')}
          title={t('pages.settings.language')}
        >
          <TranslationOutlined />
        </button>
      )}
    />
  );
}

export default function AppSidebar() {
  const { t } = useTranslation();
  const { isDark, isUltra, cycleTheme } = useTheme();
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  const { open: metricsOpen, toggle: toggleMetrics, notifyOpen, toggleNotify } = useMetricsPanel();
  const headerActions = useHeaderActions();

  // Real unread count, shared with the NotificationsBar strip: live-condition
  // alerts + active event notifications (sensors / log).
  const notifyActive = useSyncExternalStore(notifSubscribe, notifSnapshot, notifSnapshot).active;
  const notifyCount = useNotifications().length + notifyActive.length;

  const [drawerOpen, setDrawerOpen] = useState(false);

  // Active nav highlight. Hash-section clicks (/#clients …) use history.pushState
  // (so the page can smooth-scroll without a router nav) which does NOT update
  // react-router's `hash` — so we track the clicked key explicitly and fall back
  // to a route-derived key for cross-page navigation. clickedKey resets whenever
  // the actual route (pathname) changes.
  const [clickedKey, setClickedKey] = useState<string | null>(null);
  useEffect(() => { setClickedKey(null); }, [pathname]);
  const routeKey = useMemo(() => {
    if (pathname === '/settings') return '/settings';
    if (pathname === '/xray') return '/xray';
    if (pathname === '/api-docs') return '/api-docs';
    if (pathname === '/') return hash ? `/${hash}` : '/#dashboard';
    return '';
  }, [pathname, hash]);
  const activeKey = clickedKey ?? routeKey;

  // The brand logo is the (slightly hidden) metrics status-bar toggle — it only
  // opens/closes the bar and never navigates.
  const onLogoClick = useCallback(() => {
    toggleMetrics();
  }, [toggleMetrics]);

  const tabs = useMemo<{ key: string; icon: IconName; title: string }[]>(() => [
    { key: '/#dashboard', icon: 'dashboard', title: t('menu.dashboard') },
    { key: '/#inbounds', icon: 'inbound', title: t('menu.inbounds') },
    { key: '/#clients', icon: 'team', title: t('menu.clients') },
    { key: '/#groups', icon: 'groups', title: t('menu.groups') },
    { key: '/#nodes', icon: 'cluster', title: t('menu.nodes') },
    { key: '/settings', icon: 'setting', title: t('menu.settings') },
    { key: '/appearance', icon: 'setting', title: t('menu.appearance', { defaultValue: 'Appearance' }) },
    { key: '/xray', icon: 'tool', title: t('menu.xray') },
    // API Docs temporarily hidden from the header (the Appearance entry made it
    // 9 items and the row started to crowd); the /api-docs route still works.
    { key: LOGOUT_KEY, icon: 'logout', title: t('logout') },
  ], [t]);

  const navItems = useMemo(() => tabs.filter((tab) => tab.icon !== 'logout'), [tabs]);
  const utilItems = useMemo(() => tabs.filter((tab) => tab.icon === 'logout'), [tabs]);

  const openLink = useCallback(async (key: string) => {
    if (key === LOGOUT_KEY) {
      await HttpUtil.post('/logout');
      window.location.href = window.X_UI_BASE_PATH || '/';
      return;
    }

    setClickedKey(key);

    if (key.startsWith('/#')) {
      const parts = key.substring(2).split('#'); // e.g. ["inbounds"] or ["xray", "basic"]
      const targetSectionId = parts[0];

      // "Overview" goes to the very top of the home page. Always navigate('/')
      // so the router CLEARS any #section hash — otherwise a stale #inbounds
      // stays active and a reload bounces back to that section. Does NOT touch
      // the metrics bar (only the logo toggles that).
      if (targetSectionId === 'dashboard') {
        navigate('/');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      if (pathname !== '/') {
        // Redirect to / with the hash
        navigate(`/#${key.substring(2)}`);
      } else {
        // Smooth scroll to the section
        const el = document.getElementById(targetSectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          window.history.pushState(null, '', `${window.location.pathname}#${key.substring(2)}`);
        }
      }
      return;
    }
    
    navigate(key);
  }, [navigate, pathname]);



  return (
    <header className={`antigravity-header ${metricsOpen ? 'metrics-open' : ''}`}>
      <div className="header-container">
        <div className="header-left">
          <div className="brand-block" onClick={onLogoClick} style={{ cursor: 'pointer' }} title={t('menu.dashboard')}>
            <svg className="antigravity-logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 24, height: 24, marginRight: 8 }}>
              <path d="M12 2L2 22h20L12 2z" fill="var(--color-primary)" />
              <path d="M12 6l7 13H5l7-13z" fill="#FFFFFF" opacity="0.3" />
            </svg>
            <span className="brand-text">Community</span>
          </div>
        </div>

        <div className="header-center">
          <nav className="header-nav-list-container">
            <ul className="header-nav-list">
              {navItems.map((tab) => {
                const Icon = iconByName[tab.icon];
                const isActive = tab.key === activeKey;
                return (
                  <li key={tab.key} className="header-nav-item-wrapper">
                    <button
                      type="button"
                      className={`nav-menu-item ${isActive ? 'is-active' : ''}`}
                      onClick={() => openLink(tab.key)}
                    >
                      <Icon />
                      <span>{tab.title}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="header-right">
          {headerActions && (headerActions.dirty || headerActions.restartNeeded) && (
            <div className="header-save-actions">
              {headerActions.dirty && (
                <Button variant="primary" loading={headerActions.busy} onClick={headerActions.onSave}>
                  {headerActions.saveText}
                </Button>
              )}
              {headerActions.restartNeeded && !headerActions.dirty && (
                <Button variant="primary" danger loading={headerActions.busy} onClick={headerActions.onRestart}>
                  {headerActions.restartText}
                </Button>
              )}
            </div>
          )}
          <button
            type="button"
            className={`sidebar-theme-cycle sidebar-bell ${notifyOpen ? 'is-active' : ''}`}
            aria-label={t('menu.notifications', { defaultValue: 'Notifications' })}
            title={t('menu.notifications', { defaultValue: 'Notifications' })}
            onClick={toggleNotify}
          >
            <BellOutlined />
            {notifyCount > 0 && (
              <span className="notif-badge">{notifyCount > 99 ? '99+' : notifyCount}</span>
            )}
          </button>
          <button
            type="button"
            className="logout-pill-btn"
            onClick={() => openLink(LOGOUT_KEY)}
          >
            {t('logout')}
          </button>
          <ThemeCycleButton
            id="theme-cycle"
            isDark={isDark}
            isUltra={isUltra}
            onCycle={() => cycleTheme('theme-cycle')}
            ariaLabel={t('menu.theme')}
          />
          <LanguageSelector />
          
          <button
            className="hamburger-menu-btn"
            type="button"
            onClick={() => setDrawerOpen(true)}
          >
            <MenuOutlined />
          </button>
        </div>
      </div>

      {drawerOpen && (
        <div className="custom-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="custom-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="brand-block">
                <span className="drawer-brand">Community</span>
              </div>
              <div className="drawer-header-actions">
                <LanguageSelector />
                <ThemeCycleButton
                  id="theme-cycle-drawer"
                  isDark={isDark}
                  isUltra={isUltra}
                  onCycle={() => cycleTheme('theme-cycle-drawer')}
                  ariaLabel={t('menu.theme')}
                />
                <button
                  className="drawer-close"
                  type="button"
                  aria-label={t('close')}
                  onClick={() => setDrawerOpen(false)}
                >
                  <CloseOutlined />
                </button>
              </div>
            </div>
            
            <div className="drawer-body">
              <ul className="drawer-nav-list">
                {navItems.map((tab) => {
                  const Icon = iconByName[tab.icon];
                  const isActive = pathname === tab.key || (tab.key.startsWith('/#') && pathname === '/' && hash === tab.key.substring(1));
                  return (
                    <li key={tab.key} className="drawer-nav-item-wrapper">
                      <button
                        type="button"
                        className={`nav-menu-item ${isActive ? 'is-active' : ''}`}
                        onClick={() => {
                          openLink(tab.key);
                          setDrawerOpen(false);
                        }}
                      >
                        <Icon />
                        <span>{tab.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <ul className="drawer-utility-list">
                {utilItems.map((tab) => {
                  const Icon = iconByName[tab.icon];
                  return (
                    <li key={tab.key}>
                      <button
                        type="button"
                        className="nav-menu-item"
                        onClick={() => {
                          openLink(tab.key);
                          setDrawerOpen(false);
                        }}
                      >
                        <Icon />
                        <span>{tab.title}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

          </div>
        </div>
      )}
    </header>
  );
}
