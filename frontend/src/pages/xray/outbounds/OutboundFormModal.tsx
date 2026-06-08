import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Dialog, Field, Input, Segmented, Select, Switch, Tabs, Tag, TooltipProvider } from '@/components/ds';
import { JsonEditor, TagListEditor } from '@/components/form';
import { FormProvider } from '@/lib/form/FormContext';
import { useFormState } from '@/lib/form/useFormState';
import { getMessage } from '@/utils/messageBus';
import { Wireguard } from '@/utils';
import {
  XMUX_DEFAULTS,
  formValuesToWirePayload,
  rawOutboundToFormValues,
} from '@/lib/xray/outbound-form-adapter';
import { parseOutboundLink } from '@/lib/xray/outbound-link-parser';
import { type OutboundFormValues } from '@/schemas/forms/outbound-form';
import { SNIFFING_OPTION } from '@/schemas/primitives';
import {
  canEnableReality,
  canEnableStream,
  canEnableTls,
  canEnableTlsFlow,
} from '@/lib/xray/protocol-capabilities';

import {
  FLOW_OPTIONS,
  HYSTERIA_NETWORK_OPTION,
  NETWORK_OPTIONS,
  PROTOCOL_OPTIONS,
  SERVER_PROTOCOLS,
} from './outbound-form-constants';
import {
  applyNetworkChange,
  buildAddModeValues,
  hysteriaStreamSlice,
  newStreamSlice,
} from './outbound-form-helpers';
import {
  BlackholeFields,
  DnsFields,
  FreedomFields,
  HttpFields,
  LoopbackFields,
  ServerTarget,
  ShadowsocksFields,
  SocksFields,
  TrojanFields,
  VlessFields,
  VmessFields,
  WireguardFields,
} from './protocols';
import {
  GrpcForm,
  HttpUpgradeForm,
  HysteriaForm,
  KcpForm,
  MuxForm,
  RawForm,
  SockoptForm,
  WsForm,
  XhttpForm,
} from './transport';
import { RealityForm, TlsForm } from './security';
import { FinalMaskForm } from '@/lib/xray/forms/transport';
import './OutboundFormModal.css';

interface OutboundFormModalProps {
  open: boolean;
  outbound: Record<string, unknown> | null;
  existingTags: string[];
  onClose: () => void;
  onConfirm: (outbound: Record<string, unknown>) => void;
}

const SNIFFING_ENTRIES = Object.entries(SNIFFING_OPTION).map(([k, v]) => ({ value: v, label: k }));

export default function OutboundFormModal({
  open,
  outbound: outboundProp,
  existingTags,
  onClose,
  onConfirm,
}: OutboundFormModalProps) {
  const { t } = useTranslation();
  const ctl = useFormState<OutboundFormValues>(buildAddModeValues);
  const [activeKey, setActiveKey] = useState('1');
  const [jsonText, setJsonText] = useState('');
  const [jsonDirty, setJsonDirty] = useState(false);
  const [linkInput, setLinkInput] = useState('');

  const isEdit = outboundProp != null;
  const title = isEdit
    ? `${t('edit')} ${t('pages.xray.Outbounds')}`
    : `+ ${t('pages.xray.Outbounds')}`;
  const okText = isEdit ? t('pages.clients.submitEdit') : t('create');

  useEffect(() => {
    if (!open) return;
    const initial = outboundProp
      ? rawOutboundToFormValues(outboundProp)
      : buildAddModeValues();
    ctl.reset(initial);
    setActiveKey('1');
    setJsonText(JSON.stringify(formValuesToWirePayload(initial), null, 2));
    setJsonDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, outboundProp]);

  const tag = (ctl.get<string>(['tag']) ?? '') as string;
  const protocol = (ctl.get<string>(['protocol']) ?? 'vless') as string;
  const network = (ctl.get<string>(['streamSettings', 'network']) ?? '') as string;
  const security = (ctl.get<string>(['streamSettings', 'security']) ?? 'none') as string;
  const streamAllowed = canEnableStream({ protocol });
  const tlsAllowed = canEnableTls({ protocol, streamSettings: { network, security } });
  const realityAllowed = canEnableReality({ protocol, streamSettings: { network, security } });
  const tlsFlowAllowed = canEnableTlsFlow({ protocol, streamSettings: { network, security } });
  const flow = (ctl.get<string>(['settings', 'flow']) ?? '') as string;
  const reverseTag = ctl.get(['settings', 'reverseTag']);
  const reverseSniffEnabled = !!ctl.get(['settings', 'reverseSniffing', 'enabled']);

  // Stream bootstrap: give stream-capable protocols a default TCP slice.
  useEffect(() => {
    if (!streamAllowed) return;
    if (network) return;
    ctl.set(['streamSettings'], { ...newStreamSlice('tcp'), security: 'none' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamAllowed, network]);

  // Hysteria rides its own QUIC+TLS transport.
  useEffect(() => {
    if (protocol !== 'hysteria') return;
    if (network === 'hysteria' && security === 'tls') return;
    const existing = (ctl.get<Record<string, unknown>>(['streamSettings']) ?? {}) as Record<string, unknown>;
    const slice = hysteriaStreamSlice();
    if (existing.hysteriaSettings) slice.hysteriaSettings = existing.hysteriaSettings;
    if (existing.tlsSettings) slice.tlsSettings = existing.tlsSettings;
    ctl.set(['streamSettings'], slice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocol, network, security]);

  // Derive WireGuard public key from the secret key.
  const wgSecretKey = ctl.get<string>(['settings', 'secretKey']);
  useEffect(() => {
    if (protocol !== 'wireguard') return;
    const sk = (wgSecretKey ?? '').trim();
    if (!sk) {
      ctl.set(['settings', 'pubKey'], '');
      return;
    }
    try {
      const { publicKey } = Wireguard.generateKeypair(sk);
      ctl.set(['settings', 'pubKey'], publicKey);
    } catch {
      ctl.set(['settings', 'pubKey'], '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocol, wgSecretKey]);

  function onProtocolChange(next: string) {
    ctl.set(['protocol'], next);
    const built = rawOutboundToFormValues({ protocol: next });
    ctl.set(['settings'], built.settings);
    if (next === 'hysteria') {
      ctl.set(['streamSettings'], hysteriaStreamSlice());
    } else if ((ctl.get<string>(['streamSettings', 'network']) ?? '') === 'hysteria') {
      ctl.set(['streamSettings'], { ...newStreamSlice('tcp'), security: 'none' });
    }
  }

  function onSecurityChange(next: string) {
    const stream = (ctl.get<Record<string, unknown>>(['streamSettings']) ?? {}) as Record<string, unknown>;
    const cleaned = { ...stream };
    delete cleaned.tlsSettings;
    delete cleaned.realitySettings;
    if (next === 'tls') {
      cleaned.tlsSettings = {
        serverName: '', alpn: [], fingerprint: '', echConfigList: '',
        verifyPeerCertByName: '', pinnedPeerCertSha256: '',
      };
    } else if (next === 'reality') {
      cleaned.realitySettings = {
        publicKey: '', fingerprint: 'chrome', serverName: '',
        shortId: '', spiderX: '', mldsa65Verify: '',
      };
    }
    cleaned.security = next;
    ctl.set(['streamSettings'], cleaned);
  }

  function onNetworkChange(next: string) {
    const stream = (ctl.get<Record<string, unknown>>(['streamSettings']) ?? {}) as Record<string, unknown>;
    ctl.set(['streamSettings'], applyNetworkChange(protocol, stream, next));
  }

  function onXmuxToggle(checked: boolean) {
    if (!checked) return;
    const existing = ctl.get(['streamSettings', 'xhttpSettings', 'xmux']);
    const hasValues = existing && typeof existing === 'object' && Object.keys(existing).length > 0;
    if (hasValues) return;
    ctl.set(['streamSettings', 'xhttpSettings', 'xmux'], { ...XMUX_DEFAULTS });
  }

  const duplicateTag = useMemo(() => {
    const myTag = tag.trim();
    if (!myTag) return false;
    if (isEdit && (outboundProp?.tag as string | undefined) === myTag) return false;
    return (existingTags || []).includes(myTag);
  }, [tag, existingTags, isEdit, outboundProp]);

  // Parse a share link and replace form state.
  function importLink() {
    const link = linkInput.trim();
    if (!link) return;
    const parsed = parseOutboundLink(link);
    if (!parsed) {
      getMessage().error('Wrong Link!');
      return;
    }
    const currentTag = ctl.get<string>(['tag']);
    if (!parsed.tag && currentTag) parsed.tag = currentTag;
    const next = rawOutboundToFormValues(parsed);
    ctl.reset(next);
    setJsonText(JSON.stringify(formValuesToWirePayload(next), null, 2));
    setJsonDirty(false);
    setLinkInput('');
    getMessage().success('Link imported successfully');
    setActiveKey('1');
  }

  function applyJsonToForm(): boolean {
    if (!jsonDirty) return true;
    const raw = jsonText.trim();
    if (!raw) return true;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch (e) {
      getMessage().error(`JSON: ${(e as Error).message}`);
      return false;
    }
    ctl.reset(rawOutboundToFormValues(parsed));
    setJsonDirty(false);
    return true;
  }

  function onTabChange(key: string) {
    if (typeof document !== 'undefined') {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
    if (key === '2') {
      setJsonText(JSON.stringify(formValuesToWirePayload(ctl.values), null, 2));
      setJsonDirty(false);
      setActiveKey(key);
      return;
    }
    if (key === '1' && activeKey === '2') {
      if (!applyJsonToForm()) return;
    }
    setActiveKey(key);
  }

  function onOk() {
    let values: OutboundFormValues;
    if (activeKey === '2') {
      const raw = jsonText.trim();
      if (!raw) return;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch (e) {
        getMessage().error(`JSON: ${(e as Error).message}`);
        return;
      }
      values = rawOutboundToFormValues(parsed);
      ctl.reset(values);
      setJsonDirty(false);
    } else {
      values = ctl.values;
    }
    const tagValue = (values.tag ?? '').trim();
    if (!tagValue) {
      getMessage().error(t('pages.xray.outboundForm.tagRequired'));
      return;
    }
    const isDuplicateTag = (existingTags || []).includes(tagValue)
      && !(isEdit && (outboundProp?.tag as string | undefined) === tagValue);
    if (isDuplicateTag) {
      getMessage().error('Tag already used by another outbound');
      return;
    }
    onConfirm(formValuesToWirePayload(values));
  }

  const visionSeedDefaults = [900, 500, 900, 256];
  const testseed = ctl.get<number[]>(['settings', 'testseed']) ?? [];

  const basicTab = (
    <>
      <Field label={t('protocol')}>
        <Select value={protocol} onChange={onProtocolChange} options={PROTOCOL_OPTIONS} />
      </Field>

      <Field label={t('pages.xray.outbound.tag')} error={duplicateTag ? t('pages.xray.outboundForm.tagDuplicate') : undefined}>
        <Input placeholder={t('pages.xray.outboundForm.tagPlaceholder')} value={ctl.get(['tag']) ?? ''} onChange={(e) => ctl.set(['tag'], e.target.value)} />
      </Field>

      <Field label={t('pages.xray.outbound.sendThrough')}>
        <Input placeholder={t('pages.xray.outboundForm.localIpPlaceholder')} value={ctl.get(['sendThrough']) ?? ''} onChange={(e) => ctl.set(['sendThrough'], e.target.value)} />
      </Field>

      {SERVER_PROTOCOLS.has(protocol) && <ServerTarget />}
      {protocol === 'vmess' && <VmessFields />}
      {protocol === 'vless' && <VlessFields />}
      {protocol === 'trojan' && <TrojanFields />}
      {protocol === 'shadowsocks' && <ShadowsocksFields />}
      {protocol === 'http' && <HttpFields />}
      {protocol === 'socks' && <SocksFields />}
      {protocol === 'loopback' && <LoopbackFields />}
      {protocol === 'blackhole' && <BlackholeFields />}
      {protocol === 'dns' && <DnsFields />}
      {protocol === 'freedom' && <FreedomFields />}

      {protocol === 'vless' && reverseTag != null && reverseTag !== '' && (
        <>
          <Field label={t('pages.xray.outboundForm.reverseSniffing')}>
            <Switch checked={reverseSniffEnabled} onChange={(v) => ctl.set(['settings', 'reverseSniffing', 'enabled'], v)} />
          </Field>
          {reverseSniffEnabled && (
            <>
              <Field label={t('pages.inbounds.sniffingDestOverride') || 'destOverride'}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SNIFFING_ENTRIES.map((o) => {
                    const dest = ctl.get<string[]>(['settings', 'reverseSniffing', 'destOverride']) ?? [];
                    return (
                      <Tag key={o.label} tone={dest.includes(o.value) ? 'primary' : 'neutral'} style={{ cursor: 'pointer' }}
                        onClick={() => ctl.set(['settings', 'reverseSniffing', 'destOverride'], dest.includes(o.value) ? dest.filter((x) => x !== o.value) : [...dest, o.value])}>
                        {o.label}
                      </Tag>
                    );
                  })}
                </div>
              </Field>
              <Field label={t('pages.inbounds.sniffingMetadataOnly')}>
                <Switch checked={!!ctl.get(['settings', 'reverseSniffing', 'metadataOnly'])} onChange={(v) => ctl.set(['settings', 'reverseSniffing', 'metadataOnly'], v)} />
              </Field>
              <Field label={t('pages.inbounds.sniffingRouteOnly')}>
                <Switch checked={!!ctl.get(['settings', 'reverseSniffing', 'routeOnly'])} onChange={(v) => ctl.set(['settings', 'reverseSniffing', 'routeOnly'], v)} />
              </Field>
              <Field label={t('pages.inbounds.sniffingIpsExcluded')}>
                <TagListEditor value={ctl.get<string[]>(['settings', 'reverseSniffing', 'ipsExcluded'])} onChange={(v) => ctl.set(['settings', 'reverseSniffing', 'ipsExcluded'], v)} placeholder="IP/CIDR/geoip:*" separators={[',']} />
              </Field>
              <Field label={t('pages.inbounds.sniffingDomainsExcluded')}>
                <TagListEditor value={ctl.get<string[]>(['settings', 'reverseSniffing', 'domainsExcluded'])} onChange={(v) => ctl.set(['settings', 'reverseSniffing', 'domainsExcluded'], v)} placeholder="domain:*" separators={[',']} />
              </Field>
            </>
          )}
        </>
      )}

      {protocol === 'wireguard' && <WireguardFields />}

      {streamAllowed && network && (
        <>
          <Field label={t('transmission')}>
            <Select
              value={network}
              onChange={onNetworkChange}
              options={protocol === 'hysteria' ? [HYSTERIA_NETWORK_OPTION] : NETWORK_OPTIONS}
            />
          </Field>

          {network === 'tcp' && <RawForm />}
          {network === 'kcp' && <KcpForm />}
          {network === 'ws' && <WsForm />}
          {network === 'grpc' && <GrpcForm />}
          {network === 'httpupgrade' && <HttpUpgradeForm />}
          {network === 'xhttp' && <XhttpForm onXmuxToggle={onXmuxToggle} />}
          {network === 'hysteria' && <HysteriaForm />}
        </>
      )}

      {tlsFlowAllowed && (
        <Field label={t('pages.clients.flow')}>
          <Select
            value={flow}
            onChange={(v) => ctl.set(['settings', 'flow'], v)}
            options={[{ value: '', label: t('none') }, ...FLOW_OPTIONS]}
          />
        </Field>
      )}

      {tlsFlowAllowed && flow === 'xtls-rprx-vision' && (
        <>
          <Field label={t('pages.xray.outboundForm.visionTestpre')}>
            <Input type="number" min={0} value={ctl.get(['settings', 'testpre']) ?? ''} onChange={(e) => ctl.set(['settings', 'testpre'], Number(e.target.value) || 0)} />
          </Field>
          <Field label={t('pages.inbounds.form.visionTestseed')}>
            <div className="ifm-inline">
              {visionSeedDefaults.map((def, i) => (
                <Input
                  key={i}
                  type="number"
                  min={1}
                  value={testseed[i] ?? def}
                  onChange={(e) => ctl.set(['settings', 'testseed', i], Number(e.target.value) || 0)}
                />
              ))}
            </div>
          </Field>
        </>
      )}

      {streamAllowed && network && (
        <Field label={t('security')}>
          <Segmented
            value={security}
            onChange={onSecurityChange}
            options={[
              ...(network !== 'hysteria' ? [{ value: 'none', label: t('none') }] : []),
              ...(tlsAllowed ? [{ value: 'tls', label: 'TLS' }] : []),
              ...(realityAllowed ? [{ value: 'reality', label: 'Reality' }] : []),
            ]}
          />
        </Field>
      )}

      {security === 'tls' && tlsAllowed && <TlsForm />}
      {security === 'reality' && realityAllowed && <RealityForm />}

      {((streamAllowed && network) || !streamAllowed) && (
        <SockoptForm outboundTags={existingTags} />
      )}

      <FinalMaskForm
        name={['streamSettings', 'finalmask']}
        network={network}
        protocol={protocol}
      />

      <MuxForm protocol={protocol} network={network} />
    </>
  );

  const jsonTab = (
    <div className="ofm-json">
      <div className="ifm-inline">
        <Input
          value={linkInput}
          placeholder="vmess:// vless:// trojan:// ss:// hysteria2:// wireguard://"
          onChange={(e) => setLinkInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') importLink(); }}
        />
        <Button variant="primary" onClick={importLink}>Import</Button>
      </div>
      <JsonEditor
        value={jsonText}
        onChange={(next) => { setJsonText(next); setJsonDirty(true); }}
        minHeight="360px"
        maxHeight="600px"
      />
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
      title={title}
      okText={okText}
      cancelText={t('close')}
      width={780}
      onOk={onOk}
    >
      <TooltipProvider>
        <FormProvider ctl={ctl}>
          <Tabs
            activeKey={activeKey}
            onChange={onTabChange}
            items={[
              { key: '1', label: t('pages.xray.basicTemplate'), children: <div className="ifm-tab">{basicTab}</div> },
              { key: '2', label: 'JSON', children: jsonTab },
            ]}
          />
        </FormProvider>
      </TooltipProvider>
    </Dialog>
  );
}
