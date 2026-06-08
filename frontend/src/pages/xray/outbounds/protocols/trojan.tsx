import { useTranslation } from 'react-i18next';
import { Field, Input } from '@/components/ds';
import { useFormCtl } from '@/lib/form/FormContext';

export default function TrojanFields() {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  return (
    <Field label={t('password')}>
      <Input value={ctl.get(['settings', 'password']) ?? ''} onChange={(e) => ctl.set(['settings', 'password'], e.target.value)} />
    </Field>
  );
}
