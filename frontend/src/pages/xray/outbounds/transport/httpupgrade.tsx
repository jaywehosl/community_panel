import { useTranslation } from 'react-i18next';
import { Field, Input } from '@/components/ds';
import { HeaderMapEditor } from '@/components/form';
import { useFormCtl } from '@/lib/form/FormContext';

const H = ['streamSettings', 'httpupgradeSettings'] as const;

export default function HttpUpgradeForm() {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  return (
    <>
      <Field label={t('host')}>
        <Input value={ctl.get([...H, 'host']) ?? ''} onChange={(e) => ctl.set([...H, 'host'], e.target.value)} />
      </Field>
      <Field label={t('path')}>
        <Input value={ctl.get([...H, 'path']) ?? ''} onChange={(e) => ctl.set([...H, 'path'], e.target.value)} />
      </Field>
      <Field label={t('pages.inbounds.form.headers')}>
        <HeaderMapEditor mode="v1" value={ctl.get([...H, 'headers'])} onChange={(v) => ctl.set([...H, 'headers'], v)} />
      </Field>
    </>
  );
}
