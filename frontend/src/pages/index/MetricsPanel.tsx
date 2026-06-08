import { lazy, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  AreaChartOutlined,
  ApiOutlined,
  BarsOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  HddOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  SwapOutlined,
  ToolOutlined,
} from '@ant-design/icons';

import { message, Spin } from '@/components/ui';
import { LazyMount } from '@/components/utility';
import { useMetricsPanel } from '@/layouts/MetricsPanelContext';
import { useStatusQuery } from '@/api/queries/useStatusQuery';
import { setMessageInstance } from '@/utils/messageBus';
import { HttpUtil, SizeFormatter, TimeFormatter } from '@/utils';
import './MetricsPanel.css';

const LogModal = lazy(() => import('./LogModal'));
const BackupModal = lazy(() => import('./BackupModal'));
const SystemHistoryModal = lazy(() => import('./SystemHistoryModal'));
const XrayMetricsModal = lazy(() => import('./XrayMetricsModal'));
const VersionModal = lazy(() => import('./VersionModal'));

// Translate the backend warn/error hex into the Antigravity palette.
function dialColor(color: string): string {
  if (color === '#faad14') return '#FBBC05';
  if (color === '#ff4d4f') return '#EA4335';
  return '#3279F9';
}

function Gauge({ icon, percent, color }: { icon: ReactNode; percent: number; color: string }) {
  const pct = Math.min(Math.max(percent, 0), 100);
  const c = dialColor(color);
  return (
    <div className="mb-gauge" style={{ '--g-color': c } as React.CSSProperties}>
      <span className="mb-gauge__icon">{icon}</span>
      <span className="mb-gauge__track">
        <span className="mb-gauge__fill" style={{ height: `${pct}%` }} />
      </span>
      <span className="mb-gauge__pct">{pct}<i>%</i></span>
    </div>
  );
}

const XRAY_STATE_KEYS: Record<string, string> = {
  running: 'pages.index.xrayStatusRunning',
  stop: 'pages.index.xrayStatusStop',
  error: 'pages.index.xrayStatusError',
};

export default function MetricsPanel() {
  const { t } = useTranslation();
  const { open } = useMetricsPanel();
  const { status, refresh } = useStatusQuery();
  const [messageApi, messageContextHolder] = message.useMessage();
  useEffect(() => { setMessageInstance(messageApi); }, [messageApi]);

  const [showIp, setShowIp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingTip, setLoadingTip] = useState(t('loading'));

  const [logsOpen, setLogsOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [sysHistoryOpen, setSysHistoryOpen] = useState(false);
  const [xrayMetricsOpen, setXrayMetricsOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);

  const basePath = window.X_UI_BASE_PATH || '';

  const setBusy = useCallback(({ busy, tip }: { busy: boolean; tip?: string }) => {
    setLoading(busy);
    if (tip) setLoadingTip(tip);
  }, []);
  const stopXray = useCallback(async () => {
    await HttpUtil.post('/panel/api/server/stopXrayService');
    await refresh();
  }, [refresh]);
  const restartXray = useCallback(async () => {
    await HttpUtil.post('/panel/api/server/restartXrayService');
    await refresh();
  }, [refresh]);

  const stateText = t(XRAY_STATE_KEYS[status.xray.state] ?? 'pages.index.xrayStatusUnknown');
  const xrayVer = status.xray.version && status.xray.version !== 'Unknown' ? `v${status.xray.version}` : null;

  return (
    <>
      {messageContextHolder}

      {loading && (
        <div className="dash-busy-overlay">
          <Spin spinning description={loadingTip} size="large" />
        </div>
      )}

      <div className={`metrics-bar ${open ? 'is-open' : ''}`} aria-hidden={!open}>
        <div className="mb-container">
          {/* ---- LEFT: vertical equalizer gauges (under the logo) ---- */}
          <div className="mb-left">
            <div className="mb-gauges">
              <Gauge icon={<DashboardOutlined />} percent={status.cpu.percent} color={status.cpu.color} />
              <Gauge icon={<DatabaseOutlined />} percent={status.mem.percent} color={status.mem.color} />
              <Gauge icon={<SwapOutlined />} percent={status.swap.percent} color={status.swap.color} />
              <Gauge icon={<HddOutlined />} percent={status.disk.percent} color={status.disk.color} />
            </div>
          </div>

          {/* ---- CENTER: control buttons (under the nav) ---- */}
          <div className="mb-center">
            <div className="mb-controls">
              <span className="nav-menu-item mb-state">
                <span className="mb-state-dot" style={{ background: status.xray.color }} />
                <span>{stateText}</span>
              </span>
              <button type="button" className="nav-menu-item" onClick={stopXray}>
                <PoweroffOutlined /><span>{t('pages.index.stopXray')}</span>
              </button>
              <button type="button" className="nav-menu-item" onClick={restartXray}>
                <ReloadOutlined /><span>{t('pages.index.restartXray')}</span>
              </button>
              <button type="button" className="nav-menu-item" onClick={() => setBackupOpen(true)}>
                <CloudServerOutlined /><span>{t('pages.index.backupTitle')}</span>
              </button>
              <button type="button" className="nav-menu-item" onClick={() => setLogsOpen(true)}>
                <BarsOutlined /><span>{t('pages.index.logs')}</span>
              </button>
              <button type="button" className="nav-menu-item" onClick={() => setSysHistoryOpen(true)}>
                <AreaChartOutlined /><span>{t('pages.index.systemHistoryTitle')}</span>
              </button>
              <button type="button" className="nav-menu-item" onClick={() => setXrayMetricsOpen(true)}>
                <AreaChartOutlined /><span>{t('pages.index.xrayMetricsTitle')}</span>
              </button>
              <button type="button" className="nav-menu-item" onClick={() => setVersionOpen(true)}>
                <ToolOutlined /><span>{xrayVer || t('pages.index.xraySwitch')}</span>
              </button>
            </div>
          </div>

          {/* ---- RIGHT: IP column (left) + 6 uniform pills (right, under the
                 logout/theme/lang buttons). No tooltips on the data. ---- */}
          <div className="mb-right">
            <div className={`mb-ipcol ${showIp ? '' : 'ip-hidden'}`}>
              <button
                type="button"
                className="mb-eye"
                onClick={() => setShowIp((v) => !v)}
                aria-label={t('pages.index.toggleIpVisibility')}
              >
                {showIp ? <EyeOutlined /> : <EyeInvisibleOutlined />}
              </button>
              <span className="mb-ip">{status.publicIP.ipv4}</span>
              <span className="mb-ip">{status.publicIP.ipv6}</span>
            </div>
            <div className="mb-pills">
              <span className="mb-pill mb-pill--up">
                <ArrowUpOutlined /> {SizeFormatter.sizeFormat(status.netIO.up)}/s
              </span>
              <span className="mb-pill mb-pill--down">
                <ArrowDownOutlined /> {SizeFormatter.sizeFormat(status.netIO.down)}/s
              </span>
              <span className="mb-pill mb-pill--conn">
                <ApiOutlined /> TCP {status.tcpCount}
              </span>
              <span className="mb-pill mb-pill--conn">
                <SwapOutlined /> UDP {status.udpCount}
              </span>
              <span className="mb-pill mb-pill--xray">
                <ClockCircleOutlined /> {TimeFormatter.formatSecond(status.appStats.uptime)}
              </span>
              <span className="mb-pill mb-pill--os">
                <ClockCircleOutlined /> {TimeFormatter.formatSecond(status.uptime)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <LazyMount when={logsOpen}>
        <LogModal open={logsOpen} onClose={() => setLogsOpen(false)} />
      </LazyMount>
      <LazyMount when={backupOpen}>
        <BackupModal open={backupOpen} basePath={basePath} onClose={() => setBackupOpen(false)} onBusy={setBusy} />
      </LazyMount>
      <LazyMount when={sysHistoryOpen}>
        <SystemHistoryModal open={sysHistoryOpen} status={status} onClose={() => setSysHistoryOpen(false)} />
      </LazyMount>
      <LazyMount when={xrayMetricsOpen}>
        <XrayMetricsModal open={xrayMetricsOpen} onClose={() => setXrayMetricsOpen(false)} />
      </LazyMount>
      <LazyMount when={versionOpen}>
        <VersionModal open={versionOpen} status={status} onClose={() => setVersionOpen(false)} onBusy={setBusy} />
      </LazyMount>
    </>
  );
}
