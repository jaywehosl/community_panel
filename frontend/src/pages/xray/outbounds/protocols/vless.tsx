import { useTranslation } from 'react-i18next';
import { Field, Input } from '@/components/ds';
import { useFormCtl } from '@/lib/form/FormContext';

export default function VlessFields() {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  return (
    <>
      <Field label="ID">
        <Input placeholder="UUID" value={ctl.get(['settings', 'id']) ?? ''} onChange={(e) => ctl.set(['settings', 'id'], e.target.value)} />
      </Field>
      <Field label={t('encryption')}>
        <Input value={ctl.get(['settings', 'encryption']) ?? ''} onChange={(e) => ctl.set(['settings', 'encryption'], e.target.value)} />
      </Field>
      <Field label={t('pages.clients.reverseTag')}>
        <Input placeholder={t('pages.xray.outboundForm.optional')} value={ctl.get(['settings', 'reverseTag']) ?? ''} onChange={(e) => ctl.set(['settings', 'reverseTag'], e.target.value)} />
      </Field>
    </>
  );
}
