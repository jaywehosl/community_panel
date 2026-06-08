import { useTranslation } from 'react-i18next';
import { Field, Input } from '@/components/ds';
import { useFormCtl } from '@/lib/form/FormContext';

const K = ['streamSettings', 'kcpSettings'] as const;

export default function KcpForm() {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  const num = (key: string, label: string, min?: number) => (
    <Field label={label}>
      <Input type="number" min={min} value={ctl.get([...K, key]) ?? ''} onChange={(e) => ctl.set([...K, key], Number(e.target.value) || 0)} />
    </Field>
  );
  return (
    <>
      {num('mtu', 'MTU', 0)}
      {num('tti', t('pages.inbounds.form.ttiMs'), 0)}
      {num('uplinkCapacity', t('pages.inbounds.form.uplinkMbps'), 0)}
      {num('downlinkCapacity', t('pages.inbounds.form.downlinkMbps'), 0)}
      {num('cwndMultiplier', t('pages.inbounds.form.cwndMultiplier'), 1)}
      {num('maxSendingWindow', t('pages.inbounds.form.maxSendingWindow'), 0)}
    </>
  );
}
