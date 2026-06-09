import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AndroidOutlined,
  AppleOutlined,
  CopyOutlined,
  DownOutlined,
  MoonFilled,
  MoonOutlined,
  QrcodeOutlined,
  SunOutlined,
  TranslationOutlined,
} from '@ant-design/icons';

import { Button, Card, Divider, DropdownMenu, Popover, QrCode, Tag, Tooltip, TooltipProvider } from '@/components/ds';
import type { MenuEntry } from '@/components/ds';
import { ClipboardManager, IntlUtil, LanguageManager } from '@/utils';
import { isPostQuantumLink } from '@/lib/xray/inbound-link';
import { LinkTags, parseLinkParts } from '@/lib/xray/link-label';
import { getMessage } from '@/utils/messageBus';
import { pauseAnimationsUntilLeave, useTheme } from '@/hooks/useTheme';
import ParticleField from '@/components/ui/ParticleField';
import SubUsageSummary from './SubUsageSummary';
import './SubPage.css';

const QR_SIZE = 240;

const subData = window.__SUB_PAGE_DATA__ || {};

const sId = subData.sId || '';
const enabled = !!subData.enabled;
const download = subData.download || '0';
const upload = subData.upload || '0';
const total = subData.total || '∞';
const used = subData.used || '0';
const remained = subData.remained || '';
const totalByte = Number(subData.totalByte || 0);
const expireMs = Number(subData.expire || 0) * 1000;
const lastOnlineMs = Number(subData.lastOnline || 0);
const subUrl = subData.subUrl || '';
const subJsonUrl = subData.subJsonUrl || '';
const subClashUrl = subData.subClashUrl || '';
const subTitle = subData.subTitle || '';
const links: string[] = Array.isArray(subData.links) ? subData.links : [];
const linkEmails: string[] = Array.isArray(subData.emails) ? subData.emails : [];
const datepicker = subData.datepicker || 'gregorian';

const isUnlimited = totalByte <= 0 && expireMs === 0;
const isActive = (() => {
  if (!enabled) return false;
  if (totalByte > 0) {
    const usedByteCalc = Number(subData.usedByte || 0)
      || (Number(subData.downloadByte || 0) + Number(subData.uploadByte || 0));
    if (usedByteCalc >= totalByte) return false;
  }
  if (expireMs > 0 && Date.now() >= expireMs) return false;
  return true;
})();

interface DescItem { key: string; label: string; children: React.ReactNode }

function QrButton({ value, label, tone }: { value: string; label: React.ReactNode; tone?: 'success' | 'primary' | 'warning' | 'neutral' }) {
  return (
    <Popover
      side="left"
      content={(
        <div className="sub-link-qr-popover">
          <Tag tone={tone ?? 'neutral'} className="qr-tag">{label}</Tag>
          <QrCode value={value} size={QR_SIZE} />
        </div>
      )}
      trigger={<Button size="sm" icon={<QrcodeOutlined />} aria-label="QR" title="QR" />}
    />
  );
}

export default function SubPage() {
  const { t } = useTranslation();
  const { isDark, isUltra, toggleTheme, toggleUltra } = useTheme();

  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth < 576);
  const [lang, setLang] = useState<string>(() => LanguageManager.getLanguage());
  void lang;

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 576);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onLangChange = useCallback((next: string) => {
    setLang(next);
    LanguageManager.setLanguage(next);
  }, []);

  const cycleTheme = useCallback(() => {
    pauseAnimationsUntilLeave('sub-theme-cycle');
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

  const copy = useCallback(async (value: string) => {
    if (!value) return;
    const ok = await ClipboardManager.copyText(value);
    if (ok) getMessage().success(t('copied'));
  }, [t]);

  const open = useCallback((url: string) => {
    if (!url) return;
    window.open(url, '_blank');
  }, []);

  const shadowrocketUrl = useMemo(() => {
    if (!subUrl) return '';
    const separator = subUrl.includes('?') ? '&' : '?';
    const rawUrl = subUrl + separator + 'flag=shadowrocket';
    const base64Url = btoa(rawUrl).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const remark = encodeURIComponent(subTitle || sId || 'Subscription');
    return `shadowrocket://add/sub/${base64Url}?remark=${remark}`;
  }, []);

  const v2boxUrl = useMemo(
    () => `v2box://install-sub?url=${encodeURIComponent(subUrl)}&name=${encodeURIComponent(sId)}`,
    [],
  );
  const streisandUrl = useMemo(() => `streisand://import/${encodeURIComponent(subUrl)}`, []);
  const happUrl = useMemo(() => `happ://add/${subUrl}`, []);

  const pageClass = useMemo(() => {
    const classes = ['subscription-page'];
    if (isDark) classes.push('is-dark');
    if (isUltra) classes.push('is-ultra');
    return classes.join(' ');
  }, [isDark, isUltra]);

  const descriptionsItems = useMemo<DescItem[]>(() => {
    const items: DescItem[] = [
      { key: 'subId', label: t('subscription.subId'), children: sId },
      {
        key: 'status',
        label: t('subscription.status'),
        children: !enabled
          ? <Tag tone="danger">{t('subscription.inactive')}</Tag>
          : isUnlimited
            ? <Tag tone="primary">{t('subscription.unlimited')}</Tag>
            : <Tag tone={isActive ? 'success' : 'danger'}>
                {isActive ? t('subscription.active') : t('subscription.inactive')}
              </Tag>,
      },
      { key: 'down', label: t('subscription.downloaded'), children: download },
      { key: 'up', label: t('subscription.uploaded'), children: upload },
      { key: 'used', label: t('usage'), children: used },
      { key: 'total', label: t('subscription.totalQuota'), children: total },
    ];
    if (totalByte > 0) {
      items.push({ key: 'remained', label: t('remained'), children: remained });
    }
    items.push({
      key: 'lastOnline',
      label: t('lastOnline'),
      children: lastOnlineMs > 0 ? IntlUtil.formatDate(lastOnlineMs, datepicker) : '-',
    });
    items.push({
      key: 'expiry',
      label: t('subscription.expiry'),
      children: expireMs === 0
        ? t('subscription.noExpiry')
        : IntlUtil.formatDate(expireMs, datepicker),
    });
    return items;
  }, [t]);

  const androidMenuItems = useMemo<MenuEntry[]>(() => [
    { key: 'android-v2box', label: 'V2Box', onSelect: () => open(`v2box://install-sub?url=${encodeURIComponent(subUrl)}&name=${encodeURIComponent(sId)}`) },
    { key: 'android-v2rayng', label: 'V2RayNG', onSelect: () => open(`v2rayng://install-config?url=${encodeURIComponent(subUrl)}`) },
    { key: 'android-singbox', label: 'Sing-box', onSelect: () => copy(subUrl) },
    { key: 'android-v2raytun', label: 'V2RayTun', onSelect: () => copy(subUrl) },
    { key: 'android-npvtunnel', label: 'NPV Tunnel', onSelect: () => copy(subUrl) },
    { key: 'android-happ', label: 'Happ', onSelect: () => open(`happ://add/${subUrl}`) },
  ], [copy, open]);

  const iosMenuItems = useMemo<MenuEntry[]>(() => [
    { key: 'ios-shadowrocket', label: 'Shadowrocket', onSelect: () => open(shadowrocketUrl) },
    { key: 'ios-v2box', label: 'V2Box', onSelect: () => open(v2boxUrl) },
    { key: 'ios-streisand', label: 'Streisand', onSelect: () => open(streisandUrl) },
    { key: 'ios-v2raytun', label: 'V2RayTun', onSelect: () => copy(subUrl) },
    { key: 'ios-npvtunnel', label: 'NPV Tunnel', onSelect: () => copy(subUrl) },
    { key: 'ios-happ', label: 'Happ', onSelect: () => open(happUrl) },
  ], [copy, open, shadowrocketUrl, v2boxUrl, streisandUrl, happUrl]);

  const langMenuItems = useMemo<MenuEntry[]>(
    () => (LanguageManager.supportedLanguages as { value: string; name: string; icon: string }[]).map((l) => ({
      key: l.value,
      label: (
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <span aria-hidden="true">{l.icon}</span>
          <span>{l.name}</span>
        </span>
      ),
      onSelect: () => onLangChange(l.value),
    })),
    [onLangChange],
  );

  const themeIcon = !isDark ? <SunOutlined /> : !isUltra ? <MoonOutlined /> : <MoonFilled />;

  const cardTitle = (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
      <span>{t('subscription.title')}</span>
      <Tag>{sId}</Tag>
    </span>
  );

  const cardExtra = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Button
        className="toolbar-btn"
        aria-label={t('menu.theme')}
        title={t('menu.theme')}
        icon={themeIcon}
        onClick={cycleTheme}
      />
      <DropdownMenu
        align="end"
        trigger={(
          <Button
            className="toolbar-btn"
            aria-label={t('pages.settings.language')}
            icon={<TranslationOutlined />}
          />
        )}
        items={langMenuItems}
      />
    </div>
  );

  return (
    <TooltipProvider>
      <div className={pageClass}>
        <ParticleField className="sub-particle-canvas" additive={isDark} intensity={isDark ? 1.7 : 0.95} />
        <div className="content">
          <div className="sub-card-wrap">
            <Card className="subscription-card" title={cardTitle} extra={cardExtra}>
              <dl className="info-table">
                {descriptionsItems.map((it) => (
                  <div className="info-row" key={it.key}>
                    <dt className="info-label">{it.label}</dt>
                    <dd className="info-value">{it.children}</dd>
                  </div>
                ))}
              </dl>

              <SubUsageSummary
                usedByte={Number(subData.usedByte || 0)
                  || (Number(subData.downloadByte || 0) + Number(subData.uploadByte || 0))}
                totalByte={totalByte}
                usedLabel={used}
                totalLabel={total}
                remainedLabel={remained}
                expireMs={expireMs}
                isActive={isActive}
              />

              {(subUrl || subJsonUrl || subClashUrl) && (
                <>
                  <Divider>{t('subscription.title')}</Divider>
                  <div className="links-section">
                    {subUrl && (
                      <div className="sub-link-row">
                        <Tag tone="success" className="sub-link-tag">SUB</Tag>
                        <a href={subUrl} target="_blank" rel="noopener noreferrer" className="sub-link-title sub-link-anchor" title={subUrl}>
                          {sId}
                        </a>
                        <div className="sub-link-actions">
                          <Button size="sm" icon={<CopyOutlined />} onClick={() => copy(subUrl)} aria-label={t('copy')} title={t('copy')} />
                          <QrButton value={subUrl} tone="success" label={t('pages.settings.subSettings')} />
                        </div>
                      </div>
                    )}
                    {subJsonUrl && (
                      <div className="sub-link-row">
                        <Tag tone="primary" className="sub-link-tag">JSON</Tag>
                        <a href={subJsonUrl} target="_blank" rel="noopener noreferrer" className="sub-link-title sub-link-anchor" title={subJsonUrl}>
                          {sId}
                        </a>
                        <div className="sub-link-actions">
                          <Button size="sm" icon={<CopyOutlined />} onClick={() => copy(subJsonUrl)} aria-label={t('copy')} title={t('copy')} />
                          <QrButton value={subJsonUrl} tone="primary" label={`${t('pages.settings.subSettings')} JSON`} />
                        </div>
                      </div>
                    )}
                    {subClashUrl && (
                      <div className="sub-link-row">
                        <Tooltip title="Clash / Mihomo">
                          <Tag tone="warning" className="sub-link-tag">CLASH</Tag>
                        </Tooltip>
                        <a href={subClashUrl} target="_blank" rel="noopener noreferrer" className="sub-link-title sub-link-anchor" title={subClashUrl}>
                          {sId}
                        </a>
                        <div className="sub-link-actions">
                          <Button size="sm" icon={<CopyOutlined />} onClick={() => copy(subClashUrl)} aria-label={t('copy')} title={t('copy')} />
                          <QrButton value={subClashUrl} tone="warning" label="Clash / Mihomo" />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {links.length > 0 && (
                <>
                  <Divider>{t('pages.inbounds.copyLink')}</Divider>
                  <div className="links-section">
                    {links.map((link, idx) => {
                      const parts = parseLinkParts(link, linkEmails[idx] || '');
                      const fallback = `Link ${idx + 1}`;
                      const rowTitle = parts?.remark || fallback;
                      const qrLabel = [parts?.remark, linkEmails[idx]].filter(Boolean).join('-') || rowTitle;
                      const canQr = !isPostQuantumLink(link);
                      return (
                        <div key={link} className="sub-link-row">
                          {parts
                            ? <LinkTags parts={parts} />
                            : <Tag className="sub-link-tag">LINK</Tag>}
                          <span className="sub-link-title" title={rowTitle}>
                            {rowTitle}
                          </span>
                          <div className="sub-link-actions">
                            <Button size="sm" icon={<CopyOutlined />} onClick={() => copy(link)} aria-label={t('copy')} title={t('copy')} />
                            {canQr && <QrButton value={link} label={qrLabel} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <div className="apps-row">
                <DropdownMenu
                  align="start"
                  trigger={(
                    <Button block={isMobile} size="lg" variant="primary">
                      <AndroidOutlined /> Android <DownOutlined />
                    </Button>
                  )}
                  items={androidMenuItems}
                />
                <DropdownMenu
                  align="start"
                  trigger={(
                    <Button block={isMobile} size="lg" variant="primary">
                      <AppleOutlined /> iOS <DownOutlined />
                    </Button>
                  )}
                  items={iosMenuItems}
                />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
