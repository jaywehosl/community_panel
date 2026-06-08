import { useMemo } from 'react';
import { ClockCircleOutlined, InfoCircleOutlined, SafetyCertificateOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Divider, Input, Select, Switch, Tabs, Tag, Textarea } from '@/components/ds';
import type { AllSetting } from '@/models/setting';
import { SettingListItem } from '@/components/ui';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { catTabLabel } from './catTabLabel';
import { sanitizePath, normalizePath } from './uriPath';

const REMARK_MODELS: Record<string, string> = { i: 'Inbound', e: 'Email', o: 'Other' };
const REMARK_SAMPLES: Record<string, string> = { i: 'Germany', e: 'john', o: 'Relay' };
const REMARK_SEPARATORS = [' ', '-', '_', '@', ':', '~', '|', ',', '.', '/'];

interface SubscriptionGeneralTabProps {
  allSetting: AllSetting;
  updateSetting: (patch: Partial<AllSetting>) => void;
}

export default function SubscriptionGeneralTab({ allSetting, updateSetting }: SubscriptionGeneralTabProps) {
  const { t } = useTranslation();
  const { isMobile } = useMediaQuery();

  const remarkModel = useMemo(() => {
    const rm = allSetting.remarkModel || '';
    return rm.length > 1 ? rm.substring(1).split('') : [];
  }, [allSetting.remarkModel]);

  const remarkSeparator = useMemo(() => {
    const rm = allSetting.remarkModel || '-';
    return rm.length > 1 ? rm.charAt(0) : '-';
  }, [allSetting.remarkModel]);

  const remarkSample = useMemo(() => {
    const parts = remarkModel.map((k) => REMARK_SAMPLES[k]);
    return parts.length === 0 ? '' : parts.join(remarkSeparator);
  }, [remarkModel, remarkSeparator]);

  function toggleModel(k: string) {
    const next = remarkModel.includes(k) ? remarkModel.filter((x) => x !== k) : [...remarkModel, k];
    updateSetting({ remarkModel: remarkSeparator + next.join('') });
  }

  function setRemarkSeparator(sep: string) {
    const tail = (allSetting.remarkModel || '-').substring(1);
    updateSetting({ remarkModel: sep + tail });
  }

  return (
    <Tabs defaultActiveKey="1" items={[
      {
        key: '1',
        label: catTabLabel(<SettingOutlined />, t('pages.settings.panelSettings'), isMobile),
        children: (
          <>
            <SettingListItem paddings="small" title={t('pages.settings.subEnable')} description={t('pages.settings.subEnableDesc')}>
              <Switch checked={allSetting.subEnable} onChange={(v) => updateSetting({ subEnable: v })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subJsonEnableTitle')} description={t('pages.settings.subJsonEnable')}>
              <Switch checked={allSetting.subJsonEnable} onChange={(v) => updateSetting({ subJsonEnable: v })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subClashEnableTitle')}>
              <Switch checked={allSetting.subClashEnable} onChange={(v) => updateSetting({ subClashEnable: v })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subListen')} description={t('pages.settings.subListenDesc')}>
              <Input value={allSetting.subListen} onChange={(e) => updateSetting({ subListen: e.target.value })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subDomain')} description={t('pages.settings.subDomainDesc')}>
              <Input value={allSetting.subDomain} onChange={(e) => updateSetting({ subDomain: e.target.value })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subPort')} description={t('pages.settings.subPortDesc')}>
              <Input type="number" min={1} max={65535} value={allSetting.subPort} onChange={(e) => updateSetting({ subPort: Number(e.target.value) || 0 })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subPath')} description={t('pages.settings.subPathDesc')}>
              <Input
                value={allSetting.subPath}
                placeholder="/sub/"
                onChange={(e) => updateSetting({ subPath: sanitizePath(e.target.value) })}
                onBlur={() => updateSetting({ subPath: normalizePath(allSetting.subPath) })}
              />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subURI')} description={t('pages.settings.subURIDesc')}>
              <Input value={allSetting.subURI} placeholder="(http|https)://domain[:port]/path/" onChange={(e) => updateSetting({ subURI: e.target.value })} />
            </SettingListItem>
          </>
        ),
      },
      {
        key: '2',
        label: catTabLabel(<InfoCircleOutlined />, t('pages.settings.information'), isMobile),
        children: (
          <>
            <SettingListItem paddings="small" title={t('pages.settings.subEncrypt')} description={t('pages.settings.subEncryptDesc')}>
              <Switch checked={allSetting.subEncrypt} onChange={(v) => updateSetting({ subEncrypt: v })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subShowInfo')} description={t('pages.settings.subShowInfoDesc')}>
              <Switch checked={allSetting.subShowInfo} onChange={(v) => updateSetting({ subShowInfo: v })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subEmailInRemark')} description={t('pages.settings.subEmailInRemarkDesc')}>
              <Switch checked={allSetting.subEmailInRemark} onChange={(v) => updateSetting({ subEmailInRemark: v })} />
            </SettingListItem>

            <SettingListItem
              paddings="small"
              title={t('pages.settings.remarkModel')}
              description={
                <>
                  {t('pages.settings.sampleRemark')}:{' '}
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', padding: '1px 6px', borderRadius: 4, border: '1px solid var(--surface-border)', background: 'var(--surface-2)', whiteSpace: 'pre' }}>
                    {remarkSample ? `#${remarkSample}` : '—'}
                  </span>
                </>
              }
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(REMARK_MODELS).map(([k, l]) => (
                    <Tag
                      key={k}
                      tone={remarkModel.includes(k) ? 'primary' : 'neutral'}
                      onClick={() => toggleModel(k)}
                      style={{ cursor: 'pointer' }}
                    >
                      {l}
                    </Tag>
                  ))}
                </div>
                <div style={{ width: 90 }}>
                  <Select
                    value={remarkSeparator}
                    onChange={setRemarkSeparator}
                    options={REMARK_SEPARATORS.map((s) => ({ value: s, label: s === ' ' ? '␣' : s }))}
                  />
                </div>
              </div>
            </SettingListItem>

            <Divider>{t('pages.settings.subTitle')}</Divider>

            <SettingListItem paddings="small" title={t('pages.settings.subTitle')} description={t('pages.settings.subTitleDesc')}>
              <Input value={allSetting.subTitle} onChange={(e) => updateSetting({ subTitle: e.target.value })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subSupportUrl')} description={t('pages.settings.subSupportUrlDesc')}>
              <Input value={allSetting.subSupportUrl} placeholder="https://example.com" onChange={(e) => updateSetting({ subSupportUrl: e.target.value })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subProfileUrl')} description={t('pages.settings.subProfileUrlDesc')}>
              <Input value={allSetting.subProfileUrl} placeholder="https://example.com" onChange={(e) => updateSetting({ subProfileUrl: e.target.value })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subAnnounce')} description={t('pages.settings.subAnnounceDesc')}>
              <Textarea value={allSetting.subAnnounce} onChange={(e) => updateSetting({ subAnnounce: e.target.value })} />
            </SettingListItem>

            <Divider>Happ</Divider>

            <SettingListItem paddings="small" title={t('pages.settings.subEnableRouting')} description={t('pages.settings.subEnableRoutingDesc')}>
              <Switch checked={allSetting.subEnableRouting} onChange={(v) => updateSetting({ subEnableRouting: v })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subRoutingRules')} description={t('pages.settings.subRoutingRulesDesc')}>
              <Textarea value={allSetting.subRoutingRules} placeholder="happ://routing/add/..." onChange={(e) => updateSetting({ subRoutingRules: e.target.value })} />
            </SettingListItem>

            <Divider>Clash / Mihomo</Divider>

            <SettingListItem paddings="small" title={t('pages.settings.subClashEnableRouting')} description={t('pages.settings.subClashEnableRoutingDesc')}>
              <Switch checked={allSetting.subClashEnableRouting} onChange={(v) => updateSetting({ subClashEnableRouting: v })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subClashRoutingRules')} description={t('pages.settings.subClashRoutingRulesDesc')}>
              <Textarea
                value={allSetting.subClashRules}
                rows={8}
                placeholder={'GEOSITE,category-ir,DIRECT\nGEOIP,private,DIRECT'}
                onChange={(e) => updateSetting({ subClashRules: e.target.value })}
              />
            </SettingListItem>
          </>
        ),
      },
      {
        key: '3',
        label: catTabLabel(<SafetyCertificateOutlined />, t('pages.settings.certs'), isMobile),
        children: (
          <>
            <SettingListItem paddings="small" title={t('pages.settings.subCertPath')} description={t('pages.settings.subCertPathDesc')}>
              <Input value={allSetting.subCertFile} onChange={(e) => updateSetting({ subCertFile: e.target.value })} />
            </SettingListItem>
            <SettingListItem paddings="small" title={t('pages.settings.subKeyPath')} description={t('pages.settings.subKeyPathDesc')}>
              <Input value={allSetting.subKeyFile} onChange={(e) => updateSetting({ subKeyFile: e.target.value })} />
            </SettingListItem>
          </>
        ),
      },
      {
        key: '4',
        label: catTabLabel(<ClockCircleOutlined />, t('pages.settings.intervals'), isMobile),
        children: (
          <SettingListItem paddings="small" title={t('pages.settings.subUpdates')} description={t('pages.settings.subUpdatesDesc')}>
            <Input type="number" min={1} value={allSetting.subUpdates} onChange={(e) => updateSetting({ subUpdates: Number(e.target.value) || 0 })} />
          </SettingListItem>
        ),
      },
    ]} />
  );
}
