import { useTranslation } from 'react-i18next';
import { Field, Input, Select } from '@/components/ds';
import { useFormCtl } from '@/lib/form/FormContext';

import { SECURITY_OPTIONS } from '../outbound-form-constants';

export default function VmessFields() {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  return (
    <>
      <Field label="ID">
        <Input placeholder="UUID" value={ctl.get(['settings', 'id']) ?? ''} onChange={(e) => ctl.set(['settings', 'id'], e.target.value)} />
      </Field>
      <Field label={t('security')}>
        <Select value={(ctl.get(['settings', 'security']) as string) ?? ''} onChange={(v) => ctl.set(['settings', 'security'], v)} options={SECURITY_OPTIONS} />
      </Field>
    </>
  );
}
