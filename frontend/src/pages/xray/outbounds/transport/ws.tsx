import { useTranslation } from 'react-i18next';
import { Field, Input } from '@/components/ds';
import { HeaderMapEditor } from '@/components/form';
import { useFormCtl } from '@/lib/form/FormContext';

const WS = ['streamSettings', 'wsSettings'] as const;

export default function WsForm() {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  return (
    <>
      <Field label={t('host')}>
        <Input value={ctl.get([...WS, 'host']) ?? ''} onChange={(e) => ctl.set([...WS, 'host'], e.target.value)} />
      </Field>
      <Field label={t('path')}>
        <Input value={ctl.get([...WS, 'path']) ?? ''} onChange={(e) => ctl.set([...WS, 'path'], e.target.value)} />
      </Field>
      <Field label={t('pages.inbounds.form.heartbeatPeriod')}>
        <Input type="number" min={0} value={ctl.get([...WS, 'heartbeatPeriod']) ?? ''} onChange={(e) => ctl.set([...WS, 'heartbeatPeriod'], Number(e.target.value) || 0)} />
      </Field>
      <Field label={t('pages.inbounds.form.headers')}>
        <HeaderMapEditor mode="v1" value={ctl.get([...WS, 'headers'])} onChange={(v) => ctl.set([...WS, 'headers'], v)} />
      </Field>
    </>
  );
}
