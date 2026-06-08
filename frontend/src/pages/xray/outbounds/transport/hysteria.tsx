import { useTranslation } from 'react-i18next';
import { Field, Input, Select, Switch, Textarea } from '@/components/ds';
import { HeaderMapEditor } from '@/components/form';
import { useFormCtl } from '@/lib/form/FormContext';

const HS = ['streamSettings', 'hysteriaSettings'] as const;
const MASQ = [...HS, 'masquerade'] as const;

export default function HysteriaForm() {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  const masq = ctl.get<{ type?: string } | undefined>([...MASQ]);
  return (
    <>
      <Field label={t('pages.inbounds.form.version')}>
        <Input type="number" min={2} max={2} disabled value={ctl.get([...HS, 'version']) ?? 2} onChange={(e) => ctl.set([...HS, 'version'], Number(e.target.value) || 2)} />
      </Field>
      <Field label={t('pages.xray.outboundForm.authPassword')}>
        <Input value={ctl.get([...HS, 'auth']) ?? ''} onChange={(e) => ctl.set([...HS, 'auth'], e.target.value)} />
      </Field>
      <Field label={t('pages.inbounds.form.udpIdleTimeout')}>
        <Input type="number" min={1} value={ctl.get([...HS, 'udpIdleTimeout']) ?? ''} onChange={(e) => ctl.set([...HS, 'udpIdleTimeout'], Number(e.target.value) || 0)} />
      </Field>

      <Field label={t('pages.inbounds.form.masquerade')}>
        <Switch
          checked={!!masq}
          onChange={(checked) => ctl.set(
            [...MASQ],
            checked
              ? { type: '', dir: '', url: '', rewriteHost: false, insecure: false, content: '', headers: {}, statusCode: 0 }
              : undefined,
          )}
        />
      </Field>
      {masq && (
        <>
          <Field label={t('pages.inbounds.form.type')}>
            <Select
              value={masq.type ?? ''}
              onChange={(v) => ctl.set([...MASQ, 'type'], v)}
              options={[
                { value: '', label: 'default (404 page)' },
                { value: 'proxy', label: 'proxy (reverse proxy)' },
                { value: 'file', label: 'file (serve directory)' },
                { value: 'string', label: 'string (fixed body)' },
              ]}
            />
          </Field>
          {masq.type === 'proxy' && (
            <>
              <Field label={t('pages.inbounds.form.upstreamUrl')}>
                <Input placeholder="https://www.example.com" value={ctl.get([...MASQ, 'url']) ?? ''} onChange={(e) => ctl.set([...MASQ, 'url'], e.target.value)} />
              </Field>
              <Field label={t('pages.inbounds.form.rewriteHost')}>
                <Switch checked={!!ctl.get([...MASQ, 'rewriteHost'])} onChange={(v) => ctl.set([...MASQ, 'rewriteHost'], v)} />
              </Field>
              <Field label={t('pages.inbounds.form.skipTlsVerify')}>
                <Switch checked={!!ctl.get([...MASQ, 'insecure'])} onChange={(v) => ctl.set([...MASQ, 'insecure'], v)} />
              </Field>
            </>
          )}
          {masq.type === 'file' && (
            <Field label={t('pages.inbounds.form.directory')}>
              <Input placeholder="/var/www/html" value={ctl.get([...MASQ, 'dir']) ?? ''} onChange={(e) => ctl.set([...MASQ, 'dir'], e.target.value)} />
            </Field>
          )}
          {masq.type === 'string' && (
            <>
              <Field label={t('pages.inbounds.form.statusCode')}>
                <Input type="number" min={0} max={599} value={ctl.get([...MASQ, 'statusCode']) ?? ''} onChange={(e) => ctl.set([...MASQ, 'statusCode'], Number(e.target.value) || 0)} />
              </Field>
              <Field label={t('pages.inbounds.form.body')}>
                <Textarea rows={3} value={ctl.get([...MASQ, 'content']) ?? ''} onChange={(e) => ctl.set([...MASQ, 'content'], e.target.value)} />
              </Field>
              <Field label={t('pages.inbounds.form.headers')}>
                <HeaderMapEditor mode="v1" value={ctl.get([...MASQ, 'headers'])} onChange={(v) => ctl.set([...MASQ, 'headers'], v)} />
              </Field>
            </>
          )}
        </>
      )}
    </>
  );
}
