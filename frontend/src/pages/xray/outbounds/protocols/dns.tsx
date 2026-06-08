import { useTranslation } from 'react-i18next';
import { Button, Field, Input, Select } from '@/components/ds';
import { useFormCtl } from '@/lib/form/FormContext';

import { DNSRuleActions } from '@/schemas/primitives';

interface DnsRule { action?: string; qType?: string; domain?: string; rCode?: number }

export default function DnsFields() {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  const rules = ctl.get<DnsRule[]>(['settings', 'rules']) ?? [];
  const setRules = (next: DnsRule[]) => ctl.set(['settings', 'rules'], next);
  const patch = (idx: number, p: Partial<DnsRule>) => setRules(rules.map((r, i) => (i === idx ? { ...r, ...p } : r)));
  return (
    <>
      <Field label={t('pages.xray.outboundForm.rewriteNetwork')}>
        <Select
          value={(ctl.get(['settings', 'rewriteNetwork']) as string) ?? ''}
          onChange={(v) => ctl.set(['settings', 'rewriteNetwork'], v)}
          options={[
            { value: '', label: t('pages.xray.outboundForm.unchanged') },
            { value: 'udp', label: 'udp' },
            { value: 'tcp', label: 'tcp' },
          ]}
        />
      </Field>
      <Field label={t('pages.inbounds.form.rewriteAddress')}>
        <Input placeholder={t('pages.xray.outboundForm.unchangedAddress')} value={ctl.get(['settings', 'rewriteAddress']) ?? ''} onChange={(e) => ctl.set(['settings', 'rewriteAddress'], e.target.value)} />
      </Field>
      <Field label={t('pages.inbounds.form.rewritePort')}>
        <Input type="number" min={0} max={65535} value={ctl.get(['settings', 'rewritePort']) ?? ''} onChange={(e) => ctl.set(['settings', 'rewritePort'], Number(e.target.value) || 0)} />
      </Field>
      <Field label={t('pages.xray.tun.userLevel')}>
        <Input type="number" min={0} value={ctl.get(['settings', 'userLevel']) ?? ''} onChange={(e) => ctl.set(['settings', 'userLevel'], Number(e.target.value) || 0)} />
      </Field>
      <Field label={t('pages.xray.outboundForm.rules')}>
        <Button size="sm" variant="primary" onClick={() => setRules([...rules, { action: 'direct', qType: '', domain: '', rCode: 0 }])} style={{ alignSelf: 'flex-start' }}>+</Button>
      </Field>
      {rules.map((rule, index) => (
        <div key={index}>
          <Field label={t('pages.xray.outboundForm.ruleN', { n: index + 1 })}>
            <Button size="sm" danger onClick={() => setRules(rules.filter((_, i) => i !== index))}>−</Button>
          </Field>
          <Field label={t('pages.xray.outboundForm.action')}>
            <Select value={rule.action ?? 'direct'} onChange={(v) => patch(index, { action: v })} options={DNSRuleActions.map((a) => ({ value: a, label: a }))} />
          </Field>
          <Field label="QType">
            <Input placeholder="1,3,23-24" value={rule.qType ?? ''} onChange={(e) => patch(index, { qType: e.target.value })} />
          </Field>
          <Field label={t('domainName')}>
            <Input placeholder="domain:example.com" value={rule.domain ?? ''} onChange={(e) => patch(index, { domain: e.target.value })} />
          </Field>
          <Field label="RCode">
            <Input type="number" min={0} max={65535} value={rule.rCode ?? ''} onChange={(e) => patch(index, { rCode: Number(e.target.value) || 0 })} />
          </Field>
        </div>
      ))}
    </>
  );
}
