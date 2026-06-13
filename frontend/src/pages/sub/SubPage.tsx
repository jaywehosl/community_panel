import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CopyOutlined,
  MoonFilled,
  MoonOutlined,
  QrcodeOutlined,
  SunOutlined,
  TranslationOutlined,
} from '@ant-design/icons';

import { Button, Card, Divider, DropdownMenu, Popover, QrCode, Tag, Tooltip, TooltipProvider } from '@/components/ds';
import type { MenuEntry } from '@/components/ds';
import { ClipboardManager, LanguageManager } from '@/utils';
import { isPostQuantumLink } from '@/lib/xray/inbound-link';
import { LinkTags, parseLinkParts } from '@/lib/xray/link-label';
import { getMessage } from '@/utils/messageBus';
import { useTheme } from '@/hooks/useTheme';
import ParticleField from '@/components/ui/ParticleField';
import SubUsageSummary from './SubUsageSummary';
import './SubPage.css';

const QR_SIZE = 240;

const subData = window.__SUB_PAGE_DATA__ || {};

const sId = subData.sId || '';
const enabled = !!subData.enabled;
const total = subData.total || '∞';
const used = subData.used || '0';
const remained = subData.remained || '';
const totalByte = Number(subData.totalByte || 0);
const expireMs = Number(subData.expire || 0) * 1000;
const subUrl = subData.subUrl || '';
const subJsonUrl = subData.subJsonUrl || '';
const subClashUrl = subData.subClashUrl || '';
const links: string[] = Array.isArray(subData.links) ? subData.links : [];
const linkEmails: string[] = Array.isArray(subData.emails) ? subData.emails : [];

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
  const { isDark, isUltra, cycleTheme } = useTheme();

  const [lang, setLang] = useState<string>(() => LanguageManager.getLanguage());
  void lang;

  const onLangChange = useCallback((next: string) => {
    setLang(next);
    LanguageManager.setLanguage(next);
  }, []);

  const onCycleTheme = useCallback(() => {
    cycleTheme('sub-theme-cycle');
  }, [cycleTheme]);

  const copy = useCallback(async (value: string) => {
    if (!value) return;
    const ok = await ClipboardManager.copyText(value);
    if (ok) getMessage().success(t('copied'));
  }, [t]);

  const pageClass = useMemo(() => {
    const classes = ['subscription-page'];
    if (isDark) classes.push('is-dark');
    if (isUltra) classes.push('is-ultra');
    return classes.join(' ');
  }, [isDark, isUltra]);

  const statusPill = !enabled
    ? <Tag tone="danger">{t('subscription.inactive')}</Tag>
    : isUnlimited
      ? <Tag tone="primary">{t('subscription.unlimited')}</Tag>
      : <Tag tone={isActive ? 'success' : 'danger'}>
          {isActive ? t('subscription.active') : t('subscription.inactive')}
        </Tag>;

  const langMenuItems = useMemo<MenuEntry[]>(
    () => (LanguageManager.supportedLanguages as { value: string; name: string; icon: string }[]).map((l) => ({
      key: l.value,
      selected: l.value === lang,
      label: (
        <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <span aria-hidden="true">{l.icon}</span>
          <span>{l.name}</span>
        </span>
      ),
      onSelect: () => onLangChange(l.value),
    })),
    [onLangChange, lang],
  );

  const themeIcon = !isDark ? <SunOutlined /> : !isUltra ? <MoonOutlined /> : <MoonFilled />;

  const cardTitle = (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <span>{t('subscription.title')}</span>
      <Tag>{sId}</Tag>
      {statusPill}
    </span>
  );

  return (
    <TooltipProvider>
      <div className={pageClass}>
        <ParticleField className="sub-particle-canvas" additive={isDark} intensity={isDark ? 1.7 : 0.95} />

        {/* Panel-style header: logo left, theme/language right (matches AppSidebar). */}
        <header className="sub-topbar">
          <div className="sub-topbar__inner">
            <div className="brand-block">
              <svg className="antigravity-logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 24, height: 24, marginRight: 8 }}>
                <path d="M12 2L2 22h20L12 2z" fill="var(--color-primary)" />
                <path d="M12 6l7 13H5l7-13z" fill="#FFFFFF" opacity="0.3" />
              </svg>
              <span className="brand-text">Community</span>
            </div>
            <div className="sub-topbar__actions">
              <button type="button" className="sub-topbar__btn" aria-label={t('menu.theme')} title={t('menu.theme')} onClick={onCycleTheme}>
                {themeIcon}
              </button>
              <DropdownMenu
                align="end"
                trigger={(
                  <button type="button" className="sub-topbar__btn" aria-label={t('pages.settings.language')} title={t('pages.settings.language')}>
                    <TranslationOutlined />
                  </button>
                )}
                items={langMenuItems}
              />
            </div>
          </div>
        </header>

        <div className="content">
          {/* Hero tagline (same copy + place as the panel landing). */}
          <div className="sub-hero">
            <h1 className="sub-hero-title">
              Experience liftoff with next-gen connection management
            </h1>
            <p className="sub-hero-subtitle">
              A clean, spacious, and high-performance panel powered by Xray-core.
            </p>
          </div>

          <div className="sub-card-wrap">
            <Card className="subscription-card" title={cardTitle}>
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

            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
