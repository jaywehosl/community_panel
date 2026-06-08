import { useTranslation } from 'react-i18next';
import { Field, Input } from '@/components/ds';
import { useFormCtl } from '@/lib/form/FormContext';

export default function SocksFields() {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  return (
    <>
      <Field label={t('username')}>
        <Input value={ctl.get(['settings', 'user']) ?? ''} onChange={(e) => ctl.set(['settings', 'user'], e.target.value)} />
      </Field>
      <Field label={t('password')}>
        <Input value={ctl.get(['settings', 'pass']) ?? ''} onChange={(e) => ctl.set(['settings', 'pass'], e.target.value)} />
      </Field>
    </>
  );
}
