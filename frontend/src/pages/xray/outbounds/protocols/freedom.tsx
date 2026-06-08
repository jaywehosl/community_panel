import { useTranslation } from 'react-i18next';
import { Button, Field, Input, Select, Switch } from '@/components/ds';
import { TagListEditor } from '@/components/form';
import { useFormCtl } from '@/lib/form/FormContext';

import { OutboundDomainStrategies } from '@/schemas/primitives';

interface Noise { type?: string; packet?: string; delay?: string; applyTo?: string }
interface FinalRule { action?: string; network?: string; port?: string; ip?: string[]; blockDelay?: string }
interface Fragment { packets?: string; length?: string; interval?: string; maxSplit?: string }

export default function FreedomFields() {
  const { t } = useTranslation();
  const ctl = useFormCtl();

  const fragment = (ctl.get<Fragment>(['settings', 'fragment']) ?? {}) as Fragment;
  const fragmentEnabled = !!(fragment.length || fragment.interval || fragment.maxSplit);

  const noises = ctl.get<Noise[]>(['settings', 'noises']) ?? [];
  const setNoises = (next: Noise[]) => ctl.set(['settings', 'noises'], next);
  const patchNoise = (idx: number, p: Partial<Noise>) => setNoises(noises.map((n, i) => (i === idx ? { ...n, ...p } : n)));
  const newNoise = (): Noise => ({ type: 'rand', packet: '10-20', delay: '10-16', applyTo: 'ip' });

  const finalRules = ctl.get<FinalRule[]>(['settings', 'finalRules']) ?? [];
  const setFinalRules = (next: FinalRule[]) => ctl.set(['settings', 'finalRules'], next);
  const patchRule = (idx: number, p: Partial<FinalRule>) => setFinalRules(finalRules.map((r, i) => (i === idx ? { ...r, ...p } : r)));

  return (
    <>
      <Field label={t('pages.xray.balancer.balancerStrategy')}>
        <Select
          value={(ctl.get(['settings', 'domainStrategy']) as string) ?? ''}
          onChange={(v) => ctl.set(['settings', 'domainStrategy'], v)}
          options={[{ value: '', label: `(${t('none')})` }, ...OutboundDomainStrategies.map((s) => ({ value: s, label: s }))]}
        />
      </Field>
      <Field label={t('pages.xray.outboundForm.redirect')}>
        <Input value={ctl.get(['settings', 'redirect']) ?? ''} onChange={(e) => ctl.set(['settings', 'redirect'], e.target.value)} />
      </Field>
      <Field label={t('pages.xray.tun.userLevel')}>
        <Input type="number" min={0} value={ctl.get(['settings', 'userLevel']) ?? ''} onChange={(e) => ctl.set(['settings', 'userLevel'], Number(e.target.value) || 0)} />
      </Field>
      <Field label={t('pages.xray.outboundForm.proxyProtocol')}>
        <Select
          value={String(ctl.get(['settings', 'proxyProtocol']) ?? 0)}
          onChange={(v) => ctl.set(['settings', 'proxyProtocol'], Number(v))}
          options={[{ value: '0', label: `(${t('none')})` }, { value: '1', label: 'v1' }, { value: '2', label: 'v2' }]}
        />
      </Field>

      <Field label="Fragment">
        <Switch
          checked={fragmentEnabled}
          onChange={(checked) => ctl.set(
            ['settings', 'fragment'],
            checked
              ? { packets: 'tlshello', length: '100-200', interval: '10-20', maxSplit: '300-400' }
              : { packets: '', length: '', interval: '', maxSplit: '' },
          )}
        />
      </Field>
      {fragmentEnabled && (
        <>
          <Field label={t('pages.settings.subFormats.packets')}>
            <Select value={fragment.packets ?? ''} onChange={(v) => ctl.set(['settings', 'fragment', 'packets'], v)} options={[{ value: '1-3', label: '1-3' }, { value: 'tlshello', label: 'tlshello' }]} />
          </Field>
          <Field label={t('pages.settings.subFormats.length')}>
            <Input value={fragment.length ?? ''} onChange={(e) => ctl.set(['settings', 'fragment', 'length'], e.target.value)} />
          </Field>
          <Field label={t('pages.settings.subFormats.interval')}>
            <Input value={fragment.interval ?? ''} onChange={(e) => ctl.set(['settings', 'fragment', 'interval'], e.target.value)} />
          </Field>
          <Field label={t('pages.settings.subFormats.maxSplit')}>
            <Input value={fragment.maxSplit ?? ''} onChange={(e) => ctl.set(['settings', 'fragment', 'maxSplit'], e.target.value)} />
          </Field>
        </>
      )}

      <Field label={t('pages.settings.subFormats.noises')}>
        <div className="ifm-inline">
          <Switch checked={noises.length > 0} onChange={(checked) => setNoises(checked ? [newNoise()] : [])} />
          {noises.length > 0 && (
            <Button size="sm" variant="primary" onClick={() => setNoises([...noises, newNoise()])}>+</Button>
          )}
        </div>
      </Field>
      {noises.map((noise, index) => (
        <div key={index}>
          <Field label={t('pages.settings.subFormats.noiseItem', { n: index + 1 })}>
            {noises.length > 1 && <Button size="sm" danger onClick={() => setNoises(noises.filter((_, i) => i !== index))}>−</Button>}
          </Field>
          <Field label={t('pages.settings.subFormats.type')}>
            <Select value={noise.type ?? 'rand'} onChange={(v) => patchNoise(index, { type: v })} options={['rand', 'base64', 'str', 'hex'].map((v) => ({ value: v, label: v }))} />
          </Field>
          <Field label={t('pages.settings.subFormats.packet')}>
            <Input value={noise.packet ?? ''} onChange={(e) => patchNoise(index, { packet: e.target.value })} />
          </Field>
          <Field label={t('pages.settings.subFormats.delayMs')}>
            <Input value={noise.delay ?? ''} onChange={(e) => patchNoise(index, { delay: e.target.value })} />
          </Field>
          <Field label={t('pages.settings.subFormats.applyTo')}>
            <Select value={noise.applyTo ?? 'ip'} onChange={(v) => patchNoise(index, { applyTo: v })} options={['ip', 'ipv4', 'ipv6'].map((v) => ({ value: v, label: v }))} />
          </Field>
        </div>
      ))}

      <Field label={t('pages.xray.outboundForm.finalRules')}>
        <div className="ifm-inline">
          <Button size="sm" variant="primary" onClick={() => setFinalRules([...finalRules, { action: 'allow', network: '', port: '', ip: [], blockDelay: '' }])}>+</Button>
          <span className="ifm-hint">{t('pages.xray.outboundForm.overrideXrayPrivateIp')}</span>
        </div>
      </Field>
      {finalRules.map((rule, index) => (
        <div key={index}>
          <Field label={t('pages.xray.outboundForm.ruleN', { n: index + 1 })}>
            <Button size="sm" danger onClick={() => setFinalRules(finalRules.filter((_, i) => i !== index))}>−</Button>
          </Field>
          <Field label={t('pages.xray.outboundForm.action')}>
            <Select value={rule.action ?? 'allow'} onChange={(v) => patchRule(index, { action: v })} options={['allow', 'block'].map((v) => ({ value: v, label: v }))} />
          </Field>
          <Field label={t('pages.inbounds.network')}>
            <Select value={rule.network ?? ''} onChange={(v) => patchRule(index, { network: v })} options={[{ value: '', label: '(any)' }, ...['tcp', 'udp', 'tcp,udp'].map((v) => ({ value: v, label: v }))]} />
          </Field>
          <Field label={t('pages.inbounds.port')}>
            <Input placeholder="e.g. 80,443 or 1000-2000" value={rule.port ?? ''} onChange={(e) => patchRule(index, { port: e.target.value })} />
          </Field>
          <Field label="IP / CIDR / geoip">
            <TagListEditor value={rule.ip ?? []} onChange={(v) => patchRule(index, { ip: v })} placeholder="e.g. 10.0.0.0/8, geoip:private" separators={[',', ' ']} />
          </Field>
          {rule.action === 'block' && (
            <Field label={t('pages.xray.outboundForm.blockDelay')}>
              <Input placeholder="optional: 5000-10000" value={rule.blockDelay ?? ''} onChange={(e) => patchRule(index, { blockDelay: e.target.value })} />
            </Field>
          )}
        </div>
      ))}
    </>
  );
}
