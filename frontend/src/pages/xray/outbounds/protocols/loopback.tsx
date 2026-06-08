import { useTranslation } from 'react-i18next';
import { Field, Input } from '@/components/ds';
import { useFormCtl } from '@/lib/form/FormContext';

export default function LoopbackFields() {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  return (
    <Field label={t('pages.xray.outboundForm.inboundTag')}>
      <Input placeholder={t('pages.xray.outboundForm.inboundTagPlaceholder')} value={ctl.get(['settings', 'inboundTag']) ?? ''} onChange={(e) => ctl.set(['settings', 'inboundTag'], e.target.value)} />
    </Field>
  );
}
