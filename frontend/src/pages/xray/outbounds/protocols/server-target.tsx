import { useTranslation } from 'react-i18next';
import { Field, Input } from '@/components/ds';
import { useFormCtl } from '@/lib/form/FormContext';

export default function ServerTarget() {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  return (
    <>
      <Field label={t('pages.inbounds.address')}>
        <Input value={ctl.get(['settings', 'address']) ?? ''} onChange={(e) => ctl.set(['settings', 'address'], e.target.value)} />
      </Field>
      <Field label={t('pages.inbounds.port')}>
        <Input type="number" min={1} max={65535} value={ctl.get(['settings', 'port']) ?? ''} onChange={(e) => ctl.set(['settings', 'port'], Number(e.target.value) || 0)} />
      </Field>
    </>
  );
}
