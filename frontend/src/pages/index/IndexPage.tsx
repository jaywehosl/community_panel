import { lazy, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { message, Spin } from '@/components/ui';
import { Button } from '@/components/ds';

import { HttpUtil } from '@/utils';
import { useTheme } from '@/hooks/useTheme';
import { useStatusQuery } from '@/api/queries/useStatusQuery';
import { LazyMount } from '@/components/utility';
import { useMetricsPanel } from '@/layouts/MetricsPanelContext';
import InboundsPage from '@/pages/inbounds/InboundsPage';
import ClientsPage from '@/pages/clients/ClientsPage';
import GroupsPage from '@/pages/groups/GroupsPage';
import NodesPage from '@/pages/nodes/NodesPage';
import { setMessageInstance } from '@/utils/messageBus';
import MetricsPanel from './MetricsPanel';

const LogModal = lazy(() => import('./LogModal'));
const BackupModal = lazy(() => import('./BackupModal'));
const SystemHistoryModal = lazy(() => import('./SystemHistoryModal'));
const XrayMetricsModal = lazy(() => import('./XrayMetricsModal'));
const XrayLogModal = lazy(() => import('./XrayLogModal'));
const VersionModal = lazy(() => import('./VersionModal'));
import './IndexPage.css';

export default function IndexPage() {
  const { t } = useTranslation();
  const { isDark, isUltra } = useTheme();
  const { status, fetchError, refresh } = useStatusQuery();
  const { open: metricsOpen, setOpen: setMetricsOpen } = useMetricsPanel();
  const [messageApi, messageContextHolder] = message.useMessage();
  useEffect(() => { setMessageInstance(messageApi); }, [messageApi]);

  const [ipLimitEnable, setIpLimitEnable] = useState(false);
  const basePath = window.X_UI_BASE_PATH || '';

  const [logsOpen, setLogsOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [sysHistoryOpen, setSysHistoryOpen] = useState(false);
  const [xrayMetricsOpen, setXrayMetricsOpen] = useState(false);
  const [xrayLogsOpen, setXrayLogsOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingTip, setLoadingTip] = useState(t('loading'));

  useEffect(() => {
    HttpUtil.post<{ ipLimitEnable?: boolean }>('/panel/setting/defaultSettings').then((msg) => {
      if (msg?.success && msg.obj) setIpLimitEnable(!!msg.obj.ipLimitEnable);
    });
  }, []);

  const { hash } = useLocation();
  useEffect(() => {
    const targetId = hash.replace(/^#/, '').split('#')[0];
    if (!targetId) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(targetId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 300);
    return () => clearTimeout(timer);
  }, [hash]);

  const setBusy = useCallback(
    ({ busy, tip }: { busy: boolean; tip?: string }) => {
      setLoading(busy);
      if (tip) setLoadingTip(tip);
    },
    [],
  );

  const stopXray = useCallback(async () => {
    await HttpUtil.post('/panel/api/server/stopXrayService');
    await refresh();
  }, [refresh]);

  const restartXray = useCallback(async () => {
    await HttpUtil.post('/panel/api/server/restartXrayService');
    await refresh();
  }, [refresh]);

  const pageClass = `index-page ${isDark ? 'is-dark' : ''} ${isUltra ? 'is-ultra' : ''}`.trim();

  return (
    <>
      {messageContextHolder}

      {loading && (
        <div className="dash-busy-overlay">
          <Spin spinning description={loadingTip} size="large" />
        </div>
      )}

      <MetricsPanel
        open={metricsOpen}
        status={status}
        ipLimitEnable={ipLimitEnable}
        onClose={() => setMetricsOpen(false)}
        onStopXray={stopXray}
        onRestartXray={restartXray}
        onOpenLogs={() => setLogsOpen(true)}
        onOpenXrayLogs={() => setXrayLogsOpen(true)}
        onOpenVersionSwitch={() => setVersionOpen(true)}
        onOpenBackup={() => setBackupOpen(true)}
        onOpenSysHistory={() => setSysHistoryOpen(true)}
        onOpenXrayMetrics={() => setXrayMetricsOpen(true)}
      />

      <div className={`content-shell index-page-shell ${pageClass}`}>
        <div className="content-area index-page-area">
          <section id="dashboard" className="feed-section dash-hero-section">
            {fetchError ? (
              <div className="dash-error">
                <h3>{t('somethingWentWrong')}</h3>
                <p className="ds-muted">{fetchError}</p>
                <Button variant="primary" onClick={refresh}>{t('refresh')}</Button>
              </div>
            ) : (
              <div className="dash-hero">
                <h1 className="dash-hero-title">
                  Experience liftoff with next-gen connection management
                </h1>
                <p className="dash-hero-subtitle">
                  A clean, spacious, and high-performance panel powered by Xray-core.
                </p>
              </div>
            )}
          </section>

          <section id="inbounds" className="feed-section">
            <div className="section-header">
              <h2>{t('menu.inbounds')}</h2>
            </div>
            <InboundsPage />
          </section>

          <section id="clients" className="feed-section">
            <div className="section-header">
              <h2>{t('menu.clients')}</h2>
            </div>
            <ClientsPage />
          </section>

          <section id="groups" className="feed-section">
            <div className="section-header">
              <h2>{t('menu.groups')}</h2>
            </div>
            <GroupsPage />
          </section>

          <section id="nodes" className="feed-section">
            <div className="section-header">
              <h2>{t('menu.nodes')}</h2>
            </div>
            <NodesPage />
          </section>
        </div>
      </div>

      <LazyMount when={logsOpen}>
        <LogModal open={logsOpen} onClose={() => setLogsOpen(false)} />
      </LazyMount>
      <LazyMount when={backupOpen}>
        <BackupModal
          open={backupOpen}
          basePath={basePath}
          onClose={() => setBackupOpen(false)}
          onBusy={setBusy}
        />
      </LazyMount>
      <LazyMount when={sysHistoryOpen}>
        <SystemHistoryModal
          open={sysHistoryOpen}
          status={status}
          onClose={() => setSysHistoryOpen(false)}
        />
      </LazyMount>
      <LazyMount when={xrayMetricsOpen}>
        <XrayMetricsModal open={xrayMetricsOpen} onClose={() => setXrayMetricsOpen(false)} />
      </LazyMount>
      <LazyMount when={xrayLogsOpen}>
        <XrayLogModal open={xrayLogsOpen} onClose={() => setXrayLogsOpen(false)} />
      </LazyMount>
      <LazyMount when={versionOpen}>
        <VersionModal
          open={versionOpen}
          status={status}
          onClose={() => setVersionOpen(false)}
          onBusy={setBusy}
        />
      </LazyMount>
    </>
  );
}
