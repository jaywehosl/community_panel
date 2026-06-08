import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  AreaChartOutlined,
  BarsOutlined,
  CloseOutlined,
  CloudServerOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  GlobalOutlined,
  HddOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  SwapOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons';

import { Button, Stat } from '@/components/ds';
import { CPUFormatter, SizeFormatter, TimeFormatter } from '@/utils';
import type { Status } from '@/models/status';
import './MetricsPanel.css';

interface MetricsPanelProps {
  open: boolean;
  status: Status;
  ipLimitEnable: boolean;
  onClose: () => void;
  onStopXray: () => void;
  onRestartXray: () => void;
  onOpenLogs: () => void;
  onOpenXrayLogs: () => void;
  onOpenVersionSwitch: () => void;
  onOpenBackup: () => void;
  onOpenSysHistory: () => void;
  onOpenXrayMetrics: () => void;
}

// Translate the backend warn/error hex into the Antigravity palette.
function dialColor(color: string): string {
  if (color === '#faad14') return '#FBBC05';
  if (color === '#ff4d4f') return '#EA4335';
  return '#3279F9';
}

interface MetricBarProps {
  icon: ReactNode;
  label: string;
  percent: number;
  color: string;
  detail: string;
}

function MetricBar({ icon, label, percent, color, detail }: MetricBarProps) {
  const pct = Math.min(Math.max(percent, 0), 100);
  const c = dialColor(color);
  return (
    <div className="mp-bar" style={{ '--bar-color': c } as React.CSSProperties}>
      <div className="mp-bar__top">
        <span className="mp-bar__icon">{icon}</span>
        <span className="mp-bar__label">{label}</span>
        <span className="mp-bar__value">{pct}<span className="mp-bar__unit">%</span></span>
      </div>
      <div className="mp-bar__track">
        <span className="mp-bar__dots" aria-hidden="true">
          <i /><i /><i /><i />
        </span>
        <span className="mp-bar__fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="mp-bar__detail">{detail}</div>
    </div>
  );
}

const XRAY_STATE_KEYS: Record<string, string> = {
  running: 'pages.index.xrayStatusRunning',
  stop: 'pages.index.xrayStatusStop',
  error: 'pages.index.xrayStatusError',
};

export default function MetricsPanel({
  open,
  status,
  ipLimitEnable,
  onClose,
  onStopXray,
  onRestartXray,
  onOpenLogs,
  onOpenXrayLogs,
  onOpenVersionSwitch,
  onOpenBackup,
  onOpenSysHistory,
  onOpenXrayMetrics,
}: MetricsPanelProps) {
  const { t } = useTranslation();
  const [showIp, setShowIp] = useState(false);

  const stateText = t(XRAY_STATE_KEYS[status.xray.state] ?? 'pages.index.xrayStatusUnknown');
  const hasXrayError = status.xray.state === 'error' && !!status.xray.errorMsg;
  const xrayVer = status.xray.version && status.xray.version !== 'Unknown' ? `v${status.xray.version}` : null;

  return (
    <>
      <div className={`mp-scrim ${open ? 'is-open' : ''}`} aria-hidden="true" />
      <div className={`metrics-panel ${open ? 'is-open' : ''}`} role="dialog" aria-modal="false" aria-hidden={!open}>
        <div className="metrics-panel__sheet">
          <div className="mp-head">
            <span className="mp-head__title">
              <span className="mp-led" />
              {t('pages.index.serverTelemetry') || 'SYSTEM OVERVIEW'}
            </span>
            <button type="button" className="mp-close" aria-label={t('close')} onClick={onClose}>
              <CloseOutlined />
            </button>
          </div>

          <div className="mp-body">
            {/* ---- Telemetry bars ---- */}
            <div className="mp-bars">
              <MetricBar
                icon={<DashboardOutlined />}
                label={t('pages.index.cpu')}
                percent={status.cpu.percent}
                color={status.cpu.color}
                detail={`${CPUFormatter.cpuCoreFormat(status.cpuCores)} · ${CPUFormatter.cpuSpeedFormat(status.cpuSpeedMhz)}`}
              />
              <MetricBar
                icon={<DatabaseOutlined />}
                label={t('pages.index.memory')}
                percent={status.mem.percent}
                color={status.mem.color}
                detail={`${SizeFormatter.sizeFormat(status.mem.current)} / ${SizeFormatter.sizeFormat(status.mem.total)}`}
              />
              <MetricBar
                icon={<SwapOutlined />}
                label={t('pages.index.swap')}
                percent={status.swap.percent}
                color={status.swap.color}
                detail={`${SizeFormatter.sizeFormat(status.swap.current)} / ${SizeFormatter.sizeFormat(status.swap.total)}`}
              />
              <MetricBar
                icon={<HddOutlined />}
                label={t('pages.index.storage')}
                percent={status.disk.percent}
                color={status.disk.color}
                detail={`${SizeFormatter.sizeFormat(status.disk.current)} / ${SizeFormatter.sizeFormat(status.disk.total)}`}
              />
            </div>

            <div className="mp-cols">
              {/* ---- Network ---- */}
              <section className={`mp-section mp-net ${showIp ? '' : 'ip-hidden'}`}>
                <div className="mp-section__head">
                  <h3>Network</h3>
                  <button
                    type="button"
                    className="mp-eye"
                    onClick={() => setShowIp((v) => !v)}
                    aria-label={t('pages.index.toggleIpVisibility')}
                    title={t('pages.index.toggleIpVisibility')}
                  >
                    {showIp ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                  </button>
                </div>
                <div className="ds-stats-grid">
                  <Stat title={t('pages.index.upload')} prefix={<ArrowUpOutlined />} value={`${SizeFormatter.sizeFormat(status.netIO.up)}/s`} />
                  <Stat title={t('pages.index.download')} prefix={<ArrowDownOutlined />} value={`${SizeFormatter.sizeFormat(status.netIO.down)}/s`} />
                  <Stat title="TCP" prefix={<SwapOutlined />} value={status.tcpCount} />
                  <Stat title="UDP" prefix={<SwapOutlined />} value={status.udpCount} />
                  <Stat className="mp-ip-stat" title="IPv4" prefix={<GlobalOutlined />} value={status.publicIP.ipv4} />
                  <Stat className="mp-ip-stat" title="IPv6" prefix={<GlobalOutlined />} value={status.publicIP.ipv6} />
                  <Stat title={`Xray ${t('pages.index.operationHours')}`} prefix={<ThunderboltOutlined />} value={TimeFormatter.formatSecond(status.appStats.uptime)} />
                  <Stat title={`OS ${t('pages.index.operationHours')}`} prefix={<DesktopOutlined />} value={TimeFormatter.formatSecond(status.uptime)} />
                </div>
              </section>

              {/* ---- Xray + actions ---- */}
              <section className="mp-section mp-xray">
                <div className="mp-section__head">
                  <h3>Xray</h3>
                  <span className="mp-xray-state">
                    <span className="mp-xray-dot" style={{ background: status.xray.color }} />
                    {stateText}{xrayVer ? ` · ${xrayVer}` : ''}
                  </span>
                </div>

                {hasXrayError && (
                  <div className="mp-xray-error">
                    <div className="mp-xray-error__head">
                      <span>{t('pages.index.xrayStatusError')}</span>
                      <BarsOutlined className="mp-link-icon" onClick={onOpenLogs} title={t('pages.index.logs')} />
                    </div>
                    {(status.xray.errorMsg || '').split('\n').map((line, i) => (
                      <span key={i} className="mp-error-line">{line}</span>
                    ))}
                  </div>
                )}

                <div className="mp-actions">
                  <Button variant="default" size="sm" icon={<PoweroffOutlined />} onClick={onStopXray}>{t('pages.index.stopXray')}</Button>
                  <Button variant="default" size="sm" icon={<ReloadOutlined />} onClick={onRestartXray}>{t('pages.index.restartXray')}</Button>
                  <Button variant="default" size="sm" icon={<ToolOutlined />} onClick={onOpenVersionSwitch}>{xrayVer || t('pages.index.xraySwitch')}</Button>
                  {ipLimitEnable && (
                    <Button variant="default" size="sm" icon={<BarsOutlined />} onClick={onOpenXrayLogs}>{t('pages.index.logs')}</Button>
                  )}
                </div>

                <div className="mp-section__head mp-section__head--sub">
                  <h3>{t('menu.link') || 'Actions'}</h3>
                </div>
                <div className="mp-actions">
                  <Button variant="default" size="sm" icon={<BarsOutlined />} onClick={onOpenLogs}>{t('pages.index.logs')}</Button>
                  <Button variant="default" size="sm" icon={<CloudServerOutlined />} onClick={onOpenBackup}>{t('pages.index.backupTitle')}</Button>
                  <Button variant="default" size="sm" icon={<AreaChartOutlined />} onClick={onOpenSysHistory}>{t('pages.index.systemHistoryTitle')}</Button>
                  <Button variant="default" size="sm" icon={<AreaChartOutlined />} onClick={onOpenXrayMetrics}>{t('pages.index.xrayMetricsTitle')}</Button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
