import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { Dialog, Field, Input, Segmented, Select, Switch, Tabs, Tooltip, TooltipProvider } from '@/components/ds';
import { HttpUtil, NumberFormatter, RandomUtil, SizeFormatter, Wireguard } from '@/utils';
import { getMessage } from '@/utils/messageBus';
import { useFormState } from '@/lib/form/useFormState';
import { FormProvider } from '@/lib/form/FormContext';
import {
  rawInboundToFormValues,
  formValuesToWirePayload,
} from '@/lib/xray/inbound-form-adapter';
import { createDefaultInboundSettings } from '@/lib/xray/inbound-defaults';
import { composeInboundTag, isAutoInboundTag, type InboundTagInput } from '@/lib/xray/inbound-tag';
import {
  canEnableReality,
  canEnableStream,
  canEnableTls,
  isSS2022,
} from '@/lib/xray/protocol-capabilities';
import {
  InboundFormSchema,
  type InboundFormValues,
} from '@/schemas/forms/inbound-form';
import { Protocols } from '@/schemas/primitives';
import { SockoptStreamSettingsSchema } from '@/schemas/protocols/stream/sockopt';
import { HysteriaStreamSettingsSchema } from '@/schemas/protocols/stream/hysteria';
import { TlsStreamSettingsSchema } from '@/schemas/protocols/security/tls';
import { SniffingSchema } from '@/schemas/primitives/sniffing';
import { TcpStreamSettingsSchema } from '@/schemas/protocols/stream/tcp';
import { KcpStreamSettingsSchema } from '@/schemas/protocols/stream/kcp';
import { WsStreamSettingsSchema } from '@/schemas/protocols/stream/ws';
import { GrpcStreamSettingsSchema } from '@/schemas/protocols/stream/grpc';
import { HttpUpgradeStreamSettingsSchema } from '@/schemas/protocols/stream/httpupgrade';
import { XHttpStreamSettingsSchema } from '@/schemas/protocols/stream/xhttp';
import { DateTimePicker } from '@/components/form';
import { FinalMaskForm } from '@/lib/xray/forms/transport';
import './InboundFormModal.css';
import PlanVerificationModal from '@/components/ui/PlanVerificationModal';

import { AdvancedAllEditor, AdvancedSliceEditor } from './advanced-editors';
import { formatInboundIssue, formatInboundValidation } from './formatValidationError';
import {
  HttpFields,
  HysteriaFields,
  MixedFields,
  ShadowsocksFields,
  TunFields,
  TunnelFields,
  VlessFields,
  WireguardFields,
} from './protocols';
import {
  ExternalProxyForm,
  GrpcForm,
  HttpUpgradeForm,
  KcpForm,
  RawForm,
  SockoptForm,
  WsForm,
  XhttpForm,
} from './transport';
import { RealityForm, TlsForm } from './security';
import { useSecurityActions } from './useSecurityActions';
import { useInboundFallbacks } from './useInboundFallbacks';
import FallbacksCard from './FallbacksCard';
import SniffingTab from './SniffingTab';

import type { DBInbound } from '@/models/dbinbound';
import type { NodeRecord } from '@/api/queries/useNodesQuery';


const PROTOCOL_OPTIONS = Object.values(Protocols).map((p) => ({ value: p, label: p }));
const TRAFFIC_RESETS = ['never', 'hourly', 'daily', 'weekly', 'monthly'] as const;
const NODE_ELIGIBLE_PROTOCOLS = new Set<string>([
  Protocols.VLESS,
  Protocols.VMESS,
  Protocols.TROJAN,
  Protocols.SHADOWSOCKS,
  Protocols.HYSTERIA,
  Protocols.WIREGUARD,
]);

interface InboundFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  mode: 'add' | 'edit';
  dbInbound: DBInbound | null;
  dbInbounds: DBInbound[];
  availableNodes?: NodeRecord[];
}

function buildAddModeValues(): InboundFormValues {
  const settings = createDefaultInboundSettings('vless') ?? undefined;
  return rawInboundToFormValues({
    protocol: 'vless',
    settings,
    streamSettings: {
      network: 'tcp',
      security: 'none',
      tcpSettings: TcpStreamSettingsSchema.parse({ header: { type: 'none' } }),
    },
    sniffing: SniffingSchema.parse({}),
    port: RandomUtil.randomInteger(10000, 60000),
    listen: '',
    tag: '',
    enable: true,
    trafficReset: 'never',
  });
}

export default function InboundFormModal({
  open,
  onClose,
  onSaved,
  mode,
  dbInbound,
  dbInbounds,
  availableNodes,
}: InboundFormModalProps) {
  const { t } = useTranslation();
  const ctl = useFormState<InboundFormValues>(buildAddModeValues);
  const [saving, setSaving] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pendingPayload, setPendingPayload] = useState<any>(null);

  const originalPayload = useMemo(() => {
    if (mode === 'edit' && dbInbound) {
      try {
        const formVals = rawInboundToFormValues(dbInbound);
        return formValuesToWirePayload(formVals);
      } catch (e) {
        console.error('Error generating original payload:', e);
        return null;
      }
    }
    return null;
  }, [mode, dbInbound]);

  const {
    fallbacks,
    fallbackChildOptions,
    loadFallbacks,
    saveFallbacks,
    addFallback,
    updateFallback,
    removeFallback,
    moveFallback,
    addAllFallbacks,
  } = useInboundFallbacks(dbInbound, dbInbounds);

  const selectableNodes = (availableNodes || []).filter((n) => n.enable);
  const protocol = (ctl.get<string>(['protocol']) ?? '') as string;
  const isNodeEligible = NODE_ELIGIBLE_PROTOCOLS.has(protocol);
  const sniffingEnabled = ctl.get<boolean>(['sniffing', 'enabled']) ?? false;
  const vlessEncryption = ctl.get<string>(['settings', 'encryption']) ?? '';
  const ssMethod = ctl.get<string>(['settings', 'method']);
  const isSSWith2022 = isSS2022({
    protocol,
    settings: typeof ssMethod === 'string' ? { method: ssMethod } : {},
  });
  const network = ctl.get<string>(['streamSettings', 'network']) ?? '';
  const security = ctl.get<string>(['streamSettings', 'security']) ?? 'none';
  const streamEnabled = canEnableStream({ protocol });

  const wPort = ctl.get<number>(['port']);
  const wListen = (ctl.get<string>(['listen']) ?? '') as string;
  const isUdsListen = wListen.startsWith('/');
  const wNodeId = ctl.get<number | null>(['nodeId']) ?? null;
  const wTag = ctl.get<string>(['tag']) ?? '';
  const wSsNetwork = ctl.get<string>(['settings', 'network']);
  const wTunnelNetwork = ctl.get<string>(['settings', 'allowedNetwork']);
  const mixedUdpOn = ctl.get<boolean>(['settings', 'udp']) ?? false;
  const autoTagRef = useRef(true);
  const lastWrittenTagRef = useRef('');
  const currentTagInput = (): InboundTagInput => ({
    port: typeof wPort === 'number' ? wPort : 0,
    nodeId: typeof wNodeId === 'number' ? wNodeId : null,
    protocol,
    streamSettings: { network },
    settings: { network: wSsNetwork, allowedNetwork: wTunnelNetwork, udp: mixedUdpOn },
  });
  const isFallbackHost =
    (protocol === Protocols.VLESS || protocol === Protocols.TROJAN)
    && network === 'tcp'
    && (security === 'tls' || security === 'reality');

  const {
    genRealityKeypair,
    clearRealityKeypair,
    genMldsa65,
    clearMldsa65,
    randomizeRealityTarget,
    randomizeShortIds,
    getNewEchCert,
    clearEchCert,
    generateRandomPinHash,
    setCertFromPanel,
    clearCertFiles,
    onSecurityChange,
  } = useSecurityActions({ ctl, setSaving, nodeId: typeof wNodeId === 'number' ? wNodeId : null });

  const toggleExternalProxy = (on: boolean) => {
    if (on) {
      const port = (ctl.get<number>(['port'])) ?? 443;
      ctl.set(['streamSettings', 'externalProxy'], [{
        forceTls: 'same',
        dest: typeof window !== 'undefined' ? window.location.hostname : '',
        port,
        remark: '',
        sni: '',
        fingerprint: '',
        alpn: [],
        pinnedPeerCertSha256: [],
      }]);
    } else {
      ctl.set(['streamSettings', 'externalProxy'], []);
    }
  };

  const toggleSockopt = (on: boolean) => {
    if (on) {
      ctl.set(['streamSettings', 'sockopt'], SockoptStreamSettingsSchema.parse({}));
    } else {
      ctl.set(['streamSettings', 'sockopt'], undefined);
    }
  };

  const wgSecretKey = ctl.get<string>(['settings', 'secretKey']);
  const wgPubKey = typeof wgSecretKey === 'string' && wgSecretKey.length > 0
    ? Wireguard.generateKeypair(wgSecretKey).publicKey
    : '';

  const regenInboundWg = () => {
    const kp = Wireguard.generateKeypair();
    ctl.set(['settings', 'secretKey'], kp.privateKey);
  };

  const regenWgPeerKeypair = (peerName: number) => {
    const kp = Wireguard.generateKeypair();
    ctl.set(['settings', 'peers', peerName, 'privateKey'], kp.privateKey);
    ctl.set(['settings', 'peers', peerName, 'publicKey'], kp.publicKey);
  };

  const matchesVlessAuth = (
    block: { id?: string; label?: string } | undefined | null,
    authId: string,
  ) => {
    if (block?.id === authId) return true;
    const label = (block?.label || '').toLowerCase().replace(/[-_\s]/g, '');
    if (authId === 'mlkem768') return label.includes('mlkem768');
    if (authId === 'x25519') return label.includes('x25519');
    return false;
  };

  const getNewVlessEnc = async (authId: string) => {
    if (!authId) return;
    setSaving(true);
    try {
      const msg = await HttpUtil.get('/panel/api/server/getNewVlessEnc');
      if (!msg?.success) return;
      const obj = msg.obj as {
        auths?: { decryption: string; encryption: string; label?: string; id?: string }[];
      };
      const block = (obj.auths || []).find((a) => matchesVlessAuth(a, authId));
      if (!block) return;
      ctl.set(['settings', 'decryption'], block.decryption);
      ctl.set(['settings', 'encryption'], block.encryption);
    } finally {
      setSaving(false);
    }
  };

  const clearVlessEnc = () => {
    ctl.set(['settings', 'decryption'], 'none');
    ctl.set(['settings', 'encryption'], 'none');
  };

  const selectedVlessAuth = (() => {
    const enc = typeof vlessEncryption === 'string' ? vlessEncryption : '';
    if (!enc || enc === 'none') return 'None';
    const parts = enc.split('.').filter(Boolean);
    const authKey = parts[parts.length - 1] || '';
    if (!authKey) return t('pages.inbounds.vlessAuthCustom');
    return authKey.length > 300
      ? t('pages.inbounds.vlessAuthMlkem768')
      : t('pages.inbounds.vlessAuthX25519');
  })();

  useEffect(() => {
    if (!open) return;
    const initial = mode === 'edit' && dbInbound
      ? rawInboundToFormValues(dbInbound)
      : buildAddModeValues();
    ctl.reset(initial);
    const initialTag = (initial.tag ?? '') as string;
    autoTagRef.current = isAutoInboundTag(initialTag, {
      port: initial.port ?? 0,
      nodeId: initial.nodeId ?? null,
      protocol: initial.protocol,
      streamSettings: (initial.streamSettings ?? {}) as Record<string, unknown>,
      settings: (initial.settings ?? {}) as Record<string, unknown>,
    });
    lastWrittenTagRef.current = initialTag;
    if (
      mode === 'edit'
      && dbInbound
      && (dbInbound.protocol === Protocols.VLESS || dbInbound.protocol === Protocols.TROJAN)
    ) {
      loadFallbacks(dbInbound.id);
    } else {
      loadFallbacks(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, dbInbound]);

  useEffect(() => {
    if (!open) return;
    if (wTag === lastWrittenTagRef.current) return;
    autoTagRef.current = isAutoInboundTag(wTag, currentTagInput());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wTag]);

  useEffect(() => {
    if (!open || !autoTagRef.current) return;
    const next = composeInboundTag(currentTagInput());
    if (next !== (ctl.get<string>(['tag']) ?? '')) {
      lastWrittenTagRef.current = next;
      ctl.set(['tag'], next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wPort, wNodeId, protocol, network, mixedUdpOn, wSsNetwork, wTunnelNetwork]);

  // Protocol picker reset cascades through the form (add mode only).
  const onProtocolChange = (next: string) => {
    if (mode === 'edit') return;
    ctl.set(['protocol'], next);
    const settings = createDefaultInboundSettings(next) ?? undefined;
    ctl.set(['settings'], settings);
    if (!NODE_ELIGIBLE_PROTOCOLS.has(next)) {
      ctl.set(['nodeId'], null);
    }
    if (next === Protocols.HYSTERIA) {
      const tls = TlsStreamSettingsSchema.parse({}) as Record<string, unknown>;
      tls.certificates = [{
        useFile: true,
        certificateFile: '',
        keyFile: '',
        certificate: [],
        key: [],
        oneTimeLoading: false,
        usage: 'encipherment',
        buildChain: false,
      }];
      ctl.set(['streamSettings'], {
        network: 'hysteria',
        security: 'tls',
        hysteriaSettings: HysteriaStreamSettingsSchema.parse({}),
        tlsSettings: tls,
        finalmask: {
          tcp: [],
          udp: [{ type: 'salamander', settings: { password: RandomUtil.randomLowerAndNum(16) } }],
        },
      });
    } else {
      const current = ctl.get<{ network?: string }>(['streamSettings']);
      if (current?.network === 'hysteria') {
        ctl.set(['streamSettings'], { network: 'tcp', security: 'none', tcpSettings: {} });
      }
    }
  };

  const submit = async () => {
    const values = ctl.values;
    const parsed = InboundFormSchema.safeParse(values);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      getMessage().error(formatInboundValidation(issues, values, t));
      console.error(
        '[InboundFormModal] schema validation failed:',
        issues.map((issue) => formatInboundIssue(issue, values, t)),
      );
      return;
    }
    const payload = formValuesToWirePayload(parsed.data);
    setPendingPayload(payload);
    setShowPlan(true);
  };

  const executeSave = async () => {
    if (!pendingPayload) return;
    setSaving(true);
    try {
      const url = mode === 'edit' && dbInbound
        ? `/panel/api/inbounds/update/${dbInbound.id}`
        : '/panel/api/inbounds/add';
      const msg = await HttpUtil.post(url, pendingPayload);
      if (msg?.success) {
        if (isFallbackHost) {
          const obj = msg.obj as { id?: number; Id?: number } | null;
          const masterId = mode === 'edit'
            ? dbInbound!.id
            : (obj?.id ?? obj?.Id ?? 0);
          if (masterId) await saveFallbacks(masterId);
        }
        onSaved();
        setShowPlan(false);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const title = mode === 'edit'
    ? t('pages.inbounds.modifyInbound')
    : t('pages.inbounds.addInbound');

  const okText = mode === 'edit'
    ? t('pages.clients.submitEdit')
    : t('create');

  const totalBytes = (ctl.get<number>(['total'])) ?? 0;
  const totalGB = totalBytes ? Math.round((totalBytes / SizeFormatter.ONE_GB) * 100) / 100 : 0;
  const expiry = (ctl.get<number>(['expiryTime'])) ?? 0;

  const basicTab = (
    <>
      <div className="ifm-grid ifm-grid--1-3">
        <Field label={t('enable')}>
          <Switch checked={!!ctl.get(['enable'])} onChange={(v) => ctl.set(['enable'], v)} />
        </Field>
        <Field label={t('pages.inbounds.remark')}>
          <Input value={ctl.get(['remark']) ?? ''} onChange={(e) => ctl.set(['remark'], e.target.value)} />
        </Field>
      </div>

      <div className={selectableNodes.length > 0 && isNodeEligible ? 'ifm-grid ifm-grid--2' : ''}>
        <Field label={t('pages.inbounds.protocol')}>
          <Select disabled={mode === 'edit'} value={protocol} onChange={onProtocolChange} options={PROTOCOL_OPTIONS} />
        </Field>
        {selectableNodes.length > 0 && isNodeEligible && (
          <Field label={t('pages.inbounds.deployTo')}>
            <Select
              disabled={mode === 'edit'}
              value={wNodeId == null ? '' : String(wNodeId)}
              onChange={(v) => ctl.set(['nodeId'], v === '' ? null : Number(v))}
              options={[
                { value: '', label: t('pages.inbounds.localPanel') },
                ...selectableNodes.map((n) => ({
                  value: String(n.id),
                  label: `${n.name}${n.status === 'offline' ? ' (offline)' : ''}`,
                  disabled: n.status === 'offline',
                })),
              ]}
            />
          </Field>
        )}
      </div>

      <div className="ifm-grid ifm-grid--2-1">
        <Field label={t('pages.inbounds.address')}>
          <Input placeholder={t('pages.inbounds.monitorDesc')} value={ctl.get(['listen']) ?? ''} onChange={(e) => ctl.set(['listen'], e.target.value)} />
          <span className="ifm-hint">{t('pages.inbounds.form.listenHelp')}</span>
        </Field>
        <Field label={t('pages.inbounds.port')}>
          <Input type="number" min={isUdsListen ? 0 : 1} max={65535} value={ctl.get(['port']) ?? ''} onChange={(e) => ctl.set(['port'], Number(e.target.value) || 0)} />
        </Field>
      </div>

      <div className="ifm-grid ifm-grid--2">
        <Field label={<Tooltip title={t('pages.inbounds.meansNoLimit')}><span>{t('pages.inbounds.totalFlow')}</span></Tooltip>}>
          <Input
            type="number"
            min={0}
            step={1}
            value={totalGB}
            onChange={(e) => {
              const bytes = NumberFormatter.toFixed((Number(e.target.value) || 0) * SizeFormatter.ONE_GB, 0);
              ctl.set(['total'], bytes);
            }}
          />
        </Field>
        <Field label={t('pages.inbounds.periodicTrafficResetTitle')}>
          <Select
            value={(ctl.get(['trafficReset']) as string) ?? 'never'}
            onChange={(v) => ctl.set(['trafficReset'], v)}
            options={TRAFFIC_RESETS.map((r) => ({ value: r, label: t(`pages.inbounds.periodicTrafficReset.${r}`) }))}
          />
        </Field>
      </div>

      <Field label={<Tooltip title={t('pages.inbounds.leaveBlankToNeverExpire')}><span>{t('pages.inbounds.expireDate')}</span></Tooltip>}>
        <DateTimePicker
          value={expiry > 0 ? dayjs(expiry) : null}
          onChange={(d) => ctl.set(['expiryTime'], d ? d.valueOf() : 0)}
        />
      </Field>
    </>
  );

  const fallbacksCard = (
    <FallbacksCard
      fallbacks={fallbacks}
      fallbackChildOptions={fallbackChildOptions}
      addFallback={addFallback}
      updateFallback={updateFallback}
      removeFallback={removeFallback}
      moveFallback={moveFallback}
      addAllFallbacks={addAllFallbacks}
    />
  );

  const protocolTab = (
    <>
      {protocol === Protocols.WIREGUARD && <WireguardFields wgPubKey={wgPubKey} regenInboundWg={regenInboundWg} regenWgPeerKeypair={regenWgPeerKeypair} />}
      {protocol === Protocols.TUN && <TunFields />}
      {protocol === Protocols.TUNNEL && <TunnelFields />}
      {protocol === Protocols.HTTP && <HttpFields />}
      {protocol === Protocols.MIXED && <MixedFields />}
      {protocol === Protocols.SHADOWSOCKS && <ShadowsocksFields isSSWith2022={isSSWith2022} />}
      {protocol === Protocols.VLESS && <VlessFields saving={saving} selectedVlessAuth={selectedVlessAuth} network={network} security={security} getNewVlessEnc={getNewVlessEnc} clearVlessEnc={clearVlessEnc} />}
      {isFallbackHost && fallbacksCard}
    </>
  );

  const newStreamSlice = (n: string): Record<string, unknown> => {
    switch (n) {
      case 'tcp': return TcpStreamSettingsSchema.parse({ header: { type: 'none' } });
      case 'kcp': return KcpStreamSettingsSchema.parse({});
      case 'ws': return WsStreamSettingsSchema.parse({});
      case 'grpc': return GrpcStreamSettingsSchema.parse({});
      case 'httpupgrade': return HttpUpgradeStreamSettingsSchema.parse({});
      case 'xhttp': return XHttpStreamSettingsSchema.parse({});
      default: return {};
    }
  };
  const onNetworkChange = (next: string) => {
    const ALL = ['tcpSettings', 'kcpSettings', 'wsSettings', 'grpcSettings', 'httpupgradeSettings', 'xhttpSettings'];
    const current = (ctl.get<Record<string, unknown>>(['streamSettings'])) ?? {};
    const cleaned: Record<string, unknown> = { ...current, network: next };
    for (const k of ALL) {
      if (k !== `${next}Settings`) delete cleaned[k];
    }
    cleaned[`${next}Settings`] = newStreamSlice(next);
    if (next === 'kcp') {
      const fm = (cleaned.finalmask as Record<string, unknown> | undefined) ?? {};
      const udp = Array.isArray(fm.udp) ? (fm.udp as unknown[]) : [];
      const hasMkcp = udp.some((m) => (m as { type?: string })?.type === 'mkcp-legacy');
      if (!hasMkcp) {
        cleaned.finalmask = { ...fm, udp: [...udp, { type: 'mkcp-legacy', settings: { header: '', value: '' } }] };
      }
    }
    ctl.set(['streamSettings'], cleaned);
  };

  const streamTab = (
    <>
      {protocol !== Protocols.HYSTERIA && (
        <Field label={t('transmission')}>
          <Select
            value={network}
            onChange={onNetworkChange}
            options={[
              { value: 'tcp', label: 'RAW' },
              { value: 'kcp', label: 'mKCP' },
              { value: 'ws', label: 'WebSocket' },
              { value: 'grpc', label: 'gRPC' },
              { value: 'httpupgrade', label: 'HTTPUpgrade' },
              { value: 'xhttp', label: 'XHTTP' },
            ]}
          />
        </Field>
      )}

      {protocol === Protocols.HYSTERIA && <HysteriaFields />}

      {network === 'tcp' && <RawForm />}
      {network === 'ws' && <WsForm />}
      {network === 'grpc' && <GrpcForm />}
      {network === 'xhttp' && <XhttpForm />}
      {network === 'httpupgrade' && <HttpUpgradeForm />}
      {network === 'kcp' && <KcpForm />}

      <ExternalProxyForm toggleExternalProxy={toggleExternalProxy} />
      <SockoptForm toggleSockopt={toggleSockopt} />

      <FinalMaskForm
        name={['streamSettings', 'finalmask']}
        network={network as string}
        protocol={protocol}
      />
    </>
  );

  const tlsOk = canEnableTls({ protocol, streamSettings: { network, security } });
  const realityOk = canEnableReality({ protocol, streamSettings: { network, security } });
  const tlsOnly = protocol === Protocols.HYSTERIA;
  const securityTab = (
    <>
      <Field label={t('pages.inbounds.securityTab')}>
        <Segmented
          value={security}
          onChange={(v) => { if (tlsOk) onSecurityChange(v); }}
          options={[
            ...(!tlsOnly ? [{ value: 'none', label: t('none') }] : []),
            { value: 'tls', label: 'TLS' },
            ...(realityOk ? [{ value: 'reality', label: 'Reality' }] : []),
          ]}
        />
      </Field>

      {security === 'tls' && (
        <TlsForm
          saving={saving}
          setCertFromPanel={setCertFromPanel}
          clearCertFiles={clearCertFiles}
          generateRandomPinHash={generateRandomPinHash}
          getNewEchCert={getNewEchCert}
          clearEchCert={clearEchCert}
        />
      )}

      {security === 'reality' && (
        <RealityForm
          saving={saving}
          randomizeRealityTarget={randomizeRealityTarget}
          randomizeShortIds={randomizeShortIds}
          genRealityKeypair={genRealityKeypair}
          clearRealityKeypair={clearRealityKeypair}
          genMldsa65={genMldsa65}
          clearMldsa65={clearMldsa65}
        />
      )}
    </>
  );

  const advancedTab = (
    <div className="advanced-shell">
      <div className="advanced-panel">
        <div className="advanced-panel__header">
          <div>
            <div className="advanced-panel__title">{t('pages.inbounds.advanced.title')}</div>
            <div className="advanced-panel__subtitle">{t('pages.inbounds.advanced.subtitle')}</div>
          </div>
        </div>
        <Tabs
          className="advanced-inner-tabs"
          items={[
            {
              key: 'all',
              label: t('pages.inbounds.advanced.all'),
              children: (
                <>
                  <div className="advanced-editor-meta">{t('pages.inbounds.advanced.allHelp')}</div>
                  <AdvancedAllEditor streamEnabled={streamEnabled} />
                </>
              ),
            },
            {
              key: 'settings',
              label: t('pages.inbounds.advanced.settings'),
              children: (
                <>
                  <div className="advanced-editor-meta">
                    {t('pages.inbounds.advanced.settingsHelp')}{' '}
                    <code>{'{ settings: { ... } }'}</code>.
                  </div>
                  <AdvancedSliceEditor path={['settings']} wrapKey="settings" minHeight="320px" maxHeight="540px" />
                </>
              ),
            },
            ...(streamEnabled
              ? [{
                key: 'stream',
                label: t('pages.inbounds.advanced.stream'),
                children: (
                  <>
                    <div className="advanced-editor-meta">
                      {t('pages.inbounds.advanced.streamHelp')}{' '}
                      <code>{'{ streamSettings: { ... } }'}</code>.
                    </div>
                    <AdvancedSliceEditor path={['streamSettings']} wrapKey="streamSettings" minHeight="320px" maxHeight="540px" />
                  </>
                ),
              }]
              : []),
            {
              key: 'sniffing',
              label: t('pages.inbounds.advanced.sniffing'),
              children: (
                <>
                  <div className="advanced-editor-meta">
                    {t('pages.inbounds.advanced.sniffingHelp')}{' '}
                    <code>{'{ sniffing: { ... } }'}</code>.
                  </div>
                  <AdvancedSliceEditor path={['sniffing']} wrapKey="sniffing" minHeight="240px" maxHeight="420px" />
                </>
              ),
            },
          ]}
        />
      </div>
    </div>
  );

  const sniffingTab = <SniffingTab sniffingEnabled={sniffingEnabled} />;

  const tabItems = [
    { key: 'basic', label: t('pages.xray.basicTemplate'), children: <div className="ifm-tab">{basicTab}</div> },
    ...(([
      Protocols.VLESS,
      Protocols.SHADOWSOCKS,
      Protocols.HTTP,
      Protocols.MIXED,
      Protocols.TUNNEL,
      Protocols.TUN,
      Protocols.WIREGUARD,
    ] as string[]).includes(protocol) || isFallbackHost
      ? [{ key: 'protocol', label: t('pages.inbounds.protocol'), children: <div className="ifm-tab">{protocolTab}</div> }]
      : []),
    ...(streamEnabled
      ? [
        { key: 'stream', label: t('pages.inbounds.streamTab'), children: <div className="ifm-tab">{streamTab}</div> },
        { key: 'security', label: t('pages.inbounds.securityTab'), children: <div className="ifm-tab">{securityTab}</div> },
      ]
      : []),
    { key: 'sniffing', label: t('pages.inbounds.sniffingTab'), children: <div className="ifm-tab">{sniffingTab}</div> },
    { key: 'advanced', label: t('pages.xray.advancedTemplate'), children: advancedTab },
  ];

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => { if (!o) onClose(); }}
        title={title}
        okText={okText}
        cancelText={t('close')}
        confirmLoading={saving}
        width={780}
        onOk={submit}
      >
        <TooltipProvider>
          <FormProvider ctl={ctl}>
            <Tabs items={tabItems} />
          </FormProvider>
        </TooltipProvider>
      </Dialog>
      <PlanVerificationModal
        open={showPlan}
        title="Inbound Implementation Plan"
        original={originalPayload}
        modified={pendingPayload}
        confirmLoading={saving}
        onConfirm={executeSave}
        onCancel={() => setShowPlan(false)}
      />
    </>
  );
}
