import { useTranslation } from 'react-i18next';
import { Button, Field, Input, Select, Switch } from '@/components/ds';
import { useFormCtl } from '@/lib/form/FormContext';

import { DOMAIN_STRATEGY_OPTION, TCP_CONGESTION_OPTION } from '@/schemas/primitives';
import { HappyEyeballsSchema, SockoptStreamSettingsSchema } from '@/schemas/protocols/stream/sockopt';

import { ADDRESS_PORT_STRATEGY_OPTIONS } from '../outbound-form-constants';

const S = ['streamSettings', 'sockopt'] as const;
const HE = [...S, 'happyEyeballs'] as const;

interface CustomSockopt { system?: string; type?: string; level?: string; opt?: string; value?: string }

export default function SockoptForm({ outboundTags = [] }: { outboundTags?: string[] }) {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  const hasSockopt = !!ctl.get([...S]);
  const dialerProxy = (ctl.get([...S, 'dialerProxy']) ?? '') as string;
  const dialerProxyOptions = [
    { value: '', label: t('pages.xray.outboundForm.dialerProxyPlaceholder') },
    ...Array.from(new Set([...outboundTags, dialerProxy].filter(Boolean))).map((tg) => ({ value: tg, label: tg })),
  ];

  const hasHe = ctl.get([...HE]) != null;

  const custom = ctl.get<CustomSockopt[]>([...S, 'customSockopt']) ?? [];
  const setCustom = (next: CustomSockopt[]) => ctl.set([...S, 'customSockopt'], next);

  const num = (key: string, label: string, min?: number) => (
    <Field label={label}>
      <Input type="number" min={min} value={ctl.get([...S, key]) ?? ''} onChange={(e) => ctl.set([...S, key], Number(e.target.value) || 0)} />
    </Field>
  );
  const sw = (key: string, label: string) => (
    <Field label={label}><Switch checked={!!ctl.get([...S, key])} onChange={(v) => ctl.set([...S, key], v)} /></Field>
  );
  const sel = (key: string, label: string, options: { value: string; label: string }[]) => (
    <Field label={label}><Select value={(ctl.get([...S, key]) as string) ?? ''} onChange={(v) => ctl.set([...S, key], v)} options={options} /></Field>
  );

  return (
    <>
      <Field label={t('pages.xray.outboundForm.sockopts')}>
        <Switch checked={hasSockopt} onChange={(checked) => ctl.set([...S], checked ? SockoptStreamSettingsSchema.parse({}) : undefined)} />
      </Field>
      {hasSockopt && (
        <>
          <Field label={t('pages.inbounds.form.dialerProxy')}>
            <Select value={dialerProxy} onChange={(v) => ctl.set([...S, 'dialerProxy'], v)} options={dialerProxyOptions} />
          </Field>
          {sel('domainStrategy', t('pages.xray.wireguard.domainStrategy'), Object.values(DOMAIN_STRATEGY_OPTION).map((v) => ({ value: v, label: v })))}
          {sel('addressPortStrategy', t('pages.inbounds.form.addressPortStrategy'), ADDRESS_PORT_STRATEGY_OPTIONS)}
          {num('tcpKeepAliveInterval', t('pages.xray.outboundForm.keepAliveInterval'), 0)}
          {sw('tcpFastOpen', t('pages.inbounds.form.tcpFastOpen'))}
          {sw('tcpMptcp', t('pages.inbounds.form.multipathTcp'))}
          {sw('penetrate', t('pages.inbounds.form.penetrate'))}
          {num('mark', t('pages.xray.outboundForm.markFwmark'), 0)}
          <Field label={t('pages.xray.outboundForm.interface')}>
            <Input value={ctl.get([...S, 'interface']) ?? ''} onChange={(e) => ctl.set([...S, 'interface'], e.target.value)} />
          </Field>
          {sel('tproxy', 'TProxy', [{ value: 'off', label: 'off' }, { value: 'redirect', label: 'redirect' }, { value: 'tproxy', label: 'tproxy' }])}
          {sel('tcpcongestion', t('pages.inbounds.form.tcpCongestion'), Object.values(TCP_CONGESTION_OPTION).map((v) => ({ value: v, label: v })))}
          {sw('V6Only', t('pages.xray.outboundForm.ipv6Only'))}
          {sw('acceptProxyProtocol', t('pages.xray.outboundForm.acceptProxyProtocol'))}
          {num('tcpUserTimeout', t('pages.xray.outboundForm.tcpUserTimeoutMs'), 0)}
          {num('tcpKeepAliveIdle', t('pages.xray.outboundForm.tcpKeepAliveIdleS'), 0)}
          {num('tcpMaxSeg', t('pages.inbounds.form.tcpMaxSeg'), 0)}
          {num('tcpWindowClamp', t('pages.inbounds.form.tcpWindowClamp'), 0)}
          <Field label={t('pages.inbounds.form.trustedXForwardedFor')}>
            <Input
              placeholder="trusted-proxy.example,10.0.0.0/8"
              value={(ctl.get<string[]>([...S, 'trustedXForwardedFor']) ?? []).join(',')}
              onChange={(e) => ctl.set([...S, 'trustedXForwardedFor'], e.target.value.split(/[, ]+/).map((s) => s.trim()).filter(Boolean))}
            />
          </Field>

          <Field label="Happy Eyeballs">
            <Switch checked={hasHe} onChange={(v) => ctl.set([...HE], v ? HappyEyeballsSchema.parse({}) : undefined)} />
          </Field>
          {hasHe && (
            <>
              <Field label={t('pages.inbounds.form.tryDelayMs')}>
                <Input type="number" min={0} placeholder="0 (disabled) — 250 recommended" value={ctl.get([...HE, 'tryDelayMs']) ?? ''} onChange={(e) => ctl.set([...HE, 'tryDelayMs'], Number(e.target.value) || 0)} />
              </Field>
              <Field label={t('pages.inbounds.form.prioritizeIPv6')}>
                <Switch checked={!!ctl.get([...HE, 'prioritizeIPv6'])} onChange={(v) => ctl.set([...HE, 'prioritizeIPv6'], v)} />
              </Field>
              <Field label={t('pages.inbounds.form.interleave')}>
                <Input type="number" min={1} value={ctl.get([...HE, 'interleave']) ?? ''} onChange={(e) => ctl.set([...HE, 'interleave'], Number(e.target.value) || 0)} />
              </Field>
              <Field label={t('pages.inbounds.form.maxConcurrentTry')}>
                <Input type="number" min={0} value={ctl.get([...HE, 'maxConcurrentTry']) ?? ''} onChange={(e) => ctl.set([...HE, 'maxConcurrentTry'], Number(e.target.value) || 0)} />
              </Field>
            </>
          )}

          <Field label={t('pages.inbounds.form.customSockopt')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Button variant="default" size="sm" onClick={() => setCustom([...custom, { type: 'int', level: '6', opt: '', value: '' }])} style={{ alignSelf: 'flex-start' }}>+ {t('pages.inbounds.form.addCustomOption')}</Button>
              {custom.map((row, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div style={{ width: 110 }}>
                    <Select value={row.system ?? ''} onChange={(v) => setCustom(custom.map((r, i) => (i === idx ? { ...r, system: v } : r)))} options={[{ value: '', label: 'all' }, { value: 'linux', label: 'linux' }, { value: 'windows', label: 'windows' }, { value: 'darwin', label: 'darwin' }]} />
                  </div>
                  <div style={{ width: 90 }}>
                    <Select value={row.type ?? 'int'} onChange={(v) => setCustom(custom.map((r, i) => (i === idx ? { ...r, type: v } : r)))} options={[{ value: 'int', label: 'int' }, { value: 'str', label: 'str' }]} />
                  </div>
                  <Input value={row.level ?? ''} placeholder="level" style={{ width: 90 }} onChange={(e) => setCustom(custom.map((r, i) => (i === idx ? { ...r, level: e.target.value } : r)))} />
                  <Input value={row.opt ?? ''} placeholder="opt" style={{ width: 110 }} onChange={(e) => setCustom(custom.map((r, i) => (i === idx ? { ...r, opt: e.target.value } : r)))} />
                  <Input value={row.value ?? ''} placeholder="value" onChange={(e) => setCustom(custom.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)))} />
                  <Button size="sm" danger onClick={() => setCustom(custom.filter((_, i) => i !== idx))}>−</Button>
                </div>
              ))}
            </div>
          </Field>
        </>
      )}
    </>
  );
}
