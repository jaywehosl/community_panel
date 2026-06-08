import { useTranslation } from 'react-i18next';
import { Field, Input, Switch } from '@/components/ds';
import { useFormCtl } from '@/lib/form/FormContext';

const G = ['streamSettings', 'grpcSettings'] as const;

export default function GrpcForm() {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  return (
    <>
      <Field label={t('pages.inbounds.form.serviceName')}>
        <Input value={ctl.get([...G, 'serviceName']) ?? ''} onChange={(e) => ctl.set([...G, 'serviceName'], e.target.value)} />
      </Field>
      <Field label={t('pages.inbounds.form.authority')}>
        <Input value={ctl.get([...G, 'authority']) ?? ''} onChange={(e) => ctl.set([...G, 'authority'], e.target.value)} />
      </Field>
      <Field label={t('pages.inbounds.form.multiMode')}>
        <Switch checked={!!ctl.get([...G, 'multiMode'])} onChange={(v) => ctl.set([...G, 'multiMode'], v)} />
      </Field>
    </>
  );
}
