import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  ConfigProvider,
  Layout,
  message,
  Radio,
  Result,
  Spin,
} from '@/components/ui';
import BackToTop from '@/components/ui/BackToTop';
import {
  SettingOutlined,
  SwapOutlined,
  UploadOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { VerticalTabs } from '@/components/ui';

import { useTheme } from '@/hooks/useTheme';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useXrayController } from '@/layouts/xray-controller-context';
import type { XraySettingsValue } from '@/hooks/useXraySetting';
import { JsonEditor } from '@/components/form';
import { setMessageInstance } from '@/utils/messageBus';

import { BasicsTab } from './basics';
import { RoutingTab } from './routing';
import { OutboundsTab } from './outbounds';
import { BalancersTab } from './balancers';
import { DnsTab } from './dns';
import { WarpModal, NordModal } from './overrides';
import './XrayPage.css';

const SECTION_SLUGS = ['basic', 'routing', 'outbound', 'balancer', 'dns', 'advanced'];

type AdvKey = 'xraySetting' | 'inboundSettings' | 'outboundSettings' | 'routingRuleSettings';

export default function XrayPage() {
  const { t } = useTranslation();
  const { isDark, isUltra } = useTheme();
  const { isMobile } = useMediaQuery();
  const [messageApi, messageContextHolder] = message.useMessage();
  useEffect(() => { setMessageInstance(messageApi); }, [messageApi]);
  const xs = useXrayController();
  const {
    fetched,
    fetchError,
    xraySetting,
    setXraySetting,
    templateSettings,
    setTemplateSettings,
    outboundTestUrl,
    setOutboundTestUrl,
    inboundTags,
    clientReverseTags,
    outboundsTraffic,
    outboundTestStates,
    testingAll,
    fetchAll,
    resetOutboundsTraffic,
    testOutbound,
    testAllOutbounds,
    resetToDefault,
  } = xs;

  const [warpOpen, setWarpOpen] = useState(false);
  const [nordOpen, setNordOpen] = useState(false);
  const [advSettings, setAdvSettings] = useState<AdvKey>('xraySetting');
  const location = useLocation();
  const navigate = useNavigate();
  const sectionSlug = location.hash.replace(/^#/, '');
  const activeSection = SECTION_SLUGS.includes(sectionSlug) ? sectionSlug : 'basic';

  const tabItems = useMemo(() => [
    { key: 'basic', label: t('pages.xray.basicTemplate'), icon: <SettingOutlined /> },
    { key: 'routing', label: t('pages.xray.Routings'), icon: <SwapOutlined /> },
    { key: 'outbound', label: t('pages.xray.Outbounds'), icon: <UploadOutlined /> },
    { key: 'balancer', label: t('pages.xray.Balancers'), icon: <ClusterOutlined /> },
    { key: 'dns', label: 'DNS', icon: <DatabaseOutlined /> },
    { key: 'advanced', label: t('pages.xray.advancedTemplate'), icon: <CodeOutlined /> },
  ], [t]);

  const mutate = useCallback(
    (mutator: (next: XraySettingsValue) => void) => {
      setTemplateSettings((prev) => {
        if (!prev) return prev;
        const clone = JSON.parse(JSON.stringify(prev)) as XraySettingsValue;
        mutator(clone);
        return clone;
      });
    },
    [setTemplateSettings],
  );

  async function onTestOutbound(idx: number, mode: string) {
    const outbound = templateSettings?.outbounds?.[idx];
    if (outbound) await testOutbound(idx, outbound, mode);
  }

  function onAddOutbound(outbound: Record<string, unknown>) {
    mutate((tt) => {
      if (!Array.isArray(tt.outbounds)) tt.outbounds = [];
      tt.outbounds.push(outbound as never);
    });
  }
  function onResetOutbound(payload: { index: number; outbound: Record<string, unknown>; oldTag?: string; newTag?: string }) {
    mutate((tt) => {
      if (!tt.outbounds || payload.index < 0) return;
      tt.outbounds[payload.index] = payload.outbound as never;
      if (payload.oldTag && payload.newTag && payload.oldTag !== payload.newTag) {
        const rules = tt.routing?.rules || [];
        for (const r of rules) {
          if (r?.outboundTag === payload.oldTag) r.outboundTag = payload.newTag;
        }
      }
    });
  }
  function onRemoveOutboundByTag(tag: string) {
    mutate((tt) => {
      if (!tt.outbounds) return;
      const idx = tt.outbounds.findIndex((o) => o?.tag === tag);
      if (idx >= 0) tt.outbounds.splice(idx, 1);
    });
  }
  function onRemoveOutboundByIndex(index: number) {
    mutate((tt) => {
      if (tt.outbounds && index >= 0) tt.outbounds.splice(index, 1);
    });
  }
  function onRemoveRoutingRules(payload: { prefix: string }) {
    mutate((tt) => {
      const rules = tt.routing?.rules;
      if (!Array.isArray(rules)) return;
      tt.routing!.rules = rules.filter((r) => !r?.outboundTag?.startsWith?.(payload.prefix));
    });
  }

  const advancedText = useMemo(() => {
    if (advSettings === 'xraySetting') return xraySetting;
    const tpl = templateSettings;
    if (!tpl) return '';
    try {
      switch (advSettings) {
        case 'inboundSettings': return JSON.stringify(tpl.inbounds || [], null, 2);
        case 'outboundSettings': return JSON.stringify(tpl.outbounds || [], null, 2);
        case 'routingRuleSettings': return JSON.stringify(tpl.routing?.rules || [], null, 2);
        default: return '';
      }
    } catch {
      return '';
    }
  }, [advSettings, xraySetting, templateSettings]);

  function onAdvancedTextChange(next: string) {
    if (advSettings === 'xraySetting') {
      setXraySetting(next);
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(next);
    } catch {
      return;
    }
    mutate((tt) => {
      switch (advSettings) {
        case 'inboundSettings':
          tt.inbounds = parsed;
          break;
        case 'outboundSettings':
          tt.outbounds = parsed;
          break;
        case 'routingRuleSettings':
          if (!tt.routing) tt.routing = {};
          tt.routing.rules = parsed;
          break;
      }
    });
  }

  // Save / restart orchestration + the 'xray' header-action registration now
  // live in XrayControllerProvider (layout level), so unsaved template edits —
  // and the global Save/Restart buttons — survive navigating away from here.

  const scrollTarget = () => document.getElementById('content-layout') || window;

  const pageClass = `xray-page ${isDark ? 'is-dark' : ''} ${isUltra ? 'is-ultra' : ''}`.trim();

  const sectionBody = (() => {
    switch (activeSection) {
      case 'routing':
        return (
          <RoutingTab
            templateSettings={templateSettings}
            setTemplateSettings={setTemplateSettings}
            inboundTags={inboundTags}
            clientReverseTags={clientReverseTags}
            isMobile={isMobile}
          />
        );
      case 'outbound':
        return (
          <OutboundsTab
            templateSettings={templateSettings}
            setTemplateSettings={setTemplateSettings}
            outboundsTraffic={outboundsTraffic}
            outboundTestStates={outboundTestStates}
            testingAll={testingAll}
            inboundTags={inboundTags}
            isMobile={isMobile}
            onResetTraffic={resetOutboundsTraffic}
            onTest={onTestOutbound}
            onTestAll={testAllOutbounds}
            onShowWarp={() => setWarpOpen(true)}
            onShowNord={() => setNordOpen(true)}
          />
        );
      case 'balancer':
        return (
          <BalancersTab
            templateSettings={templateSettings}
            setTemplateSettings={setTemplateSettings}
            clientReverseTags={clientReverseTags}
            isMobile={isMobile}
          />
        );
      case 'dns':
        return (
          <DnsTab
            templateSettings={templateSettings}
            setTemplateSettings={setTemplateSettings}
          />
        );
      case 'advanced':
        return (
          <>
            <div className="advanced-meta">
              <h4>{t('pages.xray.Template')}</h4>
              <p>{t('pages.xray.TemplateDesc')}</p>
            </div>
            <Radio.Group
              value={advSettings}
              buttonStyle="solid"
              size={isMobile ? 'small' : 'middle'}
              style={{ margin: '12px 0' }}
              onChange={(e: { target: { value: string } }) => setAdvSettings(e.target.value as typeof advSettings)}
            >
              <Radio.Button value="xraySetting">{t('pages.xray.completeTemplate')}</Radio.Button>
              <Radio.Button value="inboundSettings">{t('pages.xray.Inbounds')}</Radio.Button>
              <Radio.Button value="outboundSettings">{t('pages.xray.Outbounds')}</Radio.Button>
              <Radio.Button value="routingRuleSettings">{t('pages.xray.Routings')}</Radio.Button>
            </Radio.Group>
            <JsonEditor
              value={advancedText}
              onChange={onAdvancedTextChange}
              minHeight="420px"
              maxHeight="720px"
            />
          </>
        );
      default:
        return (
          <BasicsTab
            templateSettings={templateSettings}
            setTemplateSettings={setTemplateSettings}
            outboundTestUrl={outboundTestUrl}
            onChangeOutboundTestUrl={setOutboundTestUrl}
            onResetDefault={resetToDefault}
          />
        );
    }
  })();

  return (
    <ConfigProvider>
      {messageContextHolder}
      <div className={pageClass}>
        <Layout className="content-shell">
          <Layout.Content id="content-layout" className="content-area">
            <Spin spinning={!fetched} delay={200} description={t('loading')} size="large">
              {!fetched ? (
                <div className="loading-spacer" />
              ) : fetchError ? (
                <Result
                  status="error"
                  title={t('somethingWentWrong')}
                  subTitle={fetchError}
                  extra={<Button type="primary" onClick={fetchAll}>{t('check')}</Button>}
                />
              ) : (
                <>
                  {/* The "needs restart" alert now lives in the global
                      status-bar notification strip, not on-page. */}
                  <BackToTop target={scrollTarget} visibilityHeight={200} />

                  {/* Same grid as the settings page (240px sidebar + fluid
                      content) so the tab list and content widths match 1:1. */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '240px 1fr', gap: isMobile ? 8 : 16, alignItems: 'start' }}>
                    <VerticalTabs
                      items={tabItems}
                      activeKey={activeSection}
                      onChange={(key) => navigate(`#${key}`)}
                    />
                    <Card hoverable style={{ minHeight: '480px' }}>
                      {sectionBody}
                    </Card>
                  </div>
                </>
              )}
            </Spin>

        <WarpModal
          open={warpOpen}
          templateSettings={templateSettings}
          onClose={() => setWarpOpen(false)}
          onAddOutbound={onAddOutbound}
          onResetOutbound={onResetOutbound}
          onRemoveOutbound={onRemoveOutboundByTag}
        />
        <NordModal
          open={nordOpen}
          templateSettings={templateSettings}
          onClose={() => setNordOpen(false)}
          onAddOutbound={onAddOutbound}
          onResetOutbound={onResetOutbound}
          onRemoveOutbound={onRemoveOutboundByIndex}
          onRemoveRoutingRules={onRemoveRoutingRules}
        />
          </Layout.Content>
        </Layout>
      </div>
    </ConfigProvider>
  );
}
