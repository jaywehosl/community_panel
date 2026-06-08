import { useTranslation } from 'react-i18next';
import { Field, Input, Switch } from '@/components/ds';
import { HeaderMapEditor } from '@/components/form';
import { useFormCtl } from '@/lib/form/FormContext';

const HDR = ['streamSettings', 'tcpSettings', 'header'] as const;

export default function RawForm() {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  const type = (ctl.get([...HDR, 'type']) as string) ?? 'none';

  const reqPath = ctl.get<string[]>([...HDR, 'request', 'path']) ?? [];

  return (
    <>
      <Field label={`HTTP ${t('camouflage')}`}>
        <Switch
          checked={type === 'http'}
          onChange={(checked) => ctl.set(
            [...HDR],
            checked
              ? {
                type: 'http',
                request: { version: '1.1', method: 'GET', path: ['/'], headers: {} },
                response: { version: '1.1', status: '200', reason: 'OK', headers: {} },
              }
              : { type: 'none' },
          )}
        />
      </Field>
      {type === 'http' && (
        <>
          <Field label={t('pages.inbounds.form.requestVersion')}>
            <Input placeholder="1.1" value={ctl.get([...HDR, 'request', 'version']) ?? ''} onChange={(e) => ctl.set([...HDR, 'request', 'version'], e.target.value)} />
          </Field>
          <Field label={t('pages.inbounds.form.requestMethod')}>
            <Input placeholder="GET" value={ctl.get([...HDR, 'request', 'method']) ?? ''} onChange={(e) => ctl.set([...HDR, 'request', 'method'], e.target.value)} />
          </Field>
          <Field label={t('pages.inbounds.form.requestPath')}>
            <Input
              placeholder="/"
              value={Array.isArray(reqPath) ? reqPath.join(',') : reqPath}
              onChange={(e) => {
                const parts = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                ctl.set([...HDR, 'request', 'path'], parts.length > 0 ? parts : ['/']);
              }}
            />
          </Field>
          <Field label={t('pages.inbounds.form.requestHeaders')}>
            <HeaderMapEditor mode="v2" value={ctl.get([...HDR, 'request', 'headers'])} onChange={(v) => ctl.set([...HDR, 'request', 'headers'], v)} />
          </Field>

          <Field label={t('pages.inbounds.form.responseVersion')}>
            <Input placeholder="1.1" value={ctl.get([...HDR, 'response', 'version']) ?? ''} onChange={(e) => ctl.set([...HDR, 'response', 'version'], e.target.value)} />
          </Field>
          <Field label={t('pages.inbounds.form.responseStatus')}>
            <Input placeholder="200" value={ctl.get([...HDR, 'response', 'status']) ?? ''} onChange={(e) => ctl.set([...HDR, 'response', 'status'], e.target.value)} />
          </Field>
          <Field label={t('pages.inbounds.form.responseReason')}>
            <Input placeholder="OK" value={ctl.get([...HDR, 'response', 'reason']) ?? ''} onChange={(e) => ctl.set([...HDR, 'response', 'reason'], e.target.value)} />
          </Field>
          <Field label={t('pages.inbounds.form.responseHeaders')}>
            <HeaderMapEditor mode="v2" value={ctl.get([...HDR, 'response', 'headers'])} onChange={(v) => ctl.set([...HDR, 'response', 'headers'], v)} />
          </Field>
        </>
      )}
    </>
  );
}
