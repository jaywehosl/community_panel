import { useTranslation } from 'react-i18next';
import { Field, Select } from '@/components/ds';
import { useFormCtl } from '@/lib/form/FormContext';

export default function BlackholeFields() {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  return (
    <Field label={t('pages.xray.outboundForm.responseType')}>
      <Select
        value={(ctl.get(['settings', 'type']) as string) ?? ''}
        onChange={(v) => ctl.set(['settings', 'type'], v)}
        options={[
          { value: '', label: '(empty)' },
          { value: 'none', label: 'none' },
          { value: 'http', label: 'http' },
        ]}
      />
    </Field>
  );
}
