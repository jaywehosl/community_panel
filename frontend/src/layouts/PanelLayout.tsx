import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AppSidebar from '@/layouts/AppSidebar';
import { MetricsPanelProvider } from '@/layouts/MetricsPanelContext';
import { SettingsControllerProvider } from '@/layouts/SettingsController';
import { XrayControllerProvider } from '@/layouts/XrayController';
import { HeaderActionsProvider } from '@/layouts/header-actions-context';
import { BusyOverlayProvider } from '@/layouts/BusyOverlayProvider';
import MetricsPanel from '@/pages/index/MetricsPanel';
import NotificationsBar from '@/pages/index/NotificationsBar';
import SensorWatcher from '@/pages/index/SensorWatcher';
import ClientOfflineWatcher from '@/pages/index/ClientOfflineWatcher';
import LogWatcher from '@/pages/index/LogWatcher';
import MaintenanceWatcher from '@/pages/index/MaintenanceWatcher';
import { useWebSocketBridge } from '@/api/websocketBridge';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useTheme } from '@/hooks/useTheme';
import ParticleField from '@/components/ui/ParticleField';

export default function PanelLayout() {
  useWebSocketBridge();
  usePageTitle();
  const { isDark, isUltra } = useTheme();
  const { pathname } = useLocation();

  // Global scroll reset on page navigation. Pages own a #content-layout scroll
  // container (settings/xray/…); also reset the window. A second pass on the
  // next frame catches pages whose scroll container mounts a tick late.
  useEffect(() => {
    const reset = () => {
      document.getElementById('content-layout')?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
    };
    reset();
    const raf = requestAnimationFrame(reset);
    return () => cancelAnimationFrame(raf);
  }, [pathname]);
  
  const pageClass = `panel-app-wrapper ${isDark ? 'is-dark' : ''} ${isUltra ? 'is-ultra' : ''}`.trim();

  return (
    <div className={pageClass}>
      <ParticleField
        className="panel-particle-canvas"
        additive={isDark}
        intensity={isDark ? 1.7 : 0.95}
        density={1}
      />
      <MetricsPanelProvider>
        <BusyOverlayProvider>
          <HeaderActionsProvider>
            {/* Always-mounted editor controllers: their drafts (and thus the
                global Save/Restart) survive navigating away from their pages. */}
            <SettingsControllerProvider>
              <XrayControllerProvider>
                {/* Header + metrics bar share ONE fixed glass shell (single
                    backdrop-filter) so there's no seam between the two surfaces. */}
                <div className="topbar-shell">
                  <AppSidebar />
                  <MetricsPanel />
                  <NotificationsBar />
                </div>
                <SensorWatcher />
                <ClientOfflineWatcher />
                <LogWatcher />
                <MaintenanceWatcher />
                <div className="panel-main-content">
                  <Outlet />
                </div>
              </XrayControllerProvider>
            </SettingsControllerProvider>
          </HeaderActionsProvider>
        </BusyOverlayProvider>
      </MetricsPanelProvider>
    </div>
  );
}
