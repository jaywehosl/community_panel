import { useTranslation } from 'react-i18next';
import { Field, Input, Select, Textarea } from '@/components/ds';
import { useFormCtl } from '@/lib/form/FormContext';

import { UTLS_OPTIONS } from '../outbound-form-constants';

const R = ['streamSettings', 'realitySettings'] as const;

export default function RealityForm() {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  return (
    <>
      <Field label="SNI">
        <Input value={ctl.get([...R, 'serverName']) ?? ''} onChange={(e) => ctl.set([...R, 'serverName'], e.target.value)} />
      </Field>
      <Field label="uTLS">
        <Select value={(ctl.get([...R, 'fingerprint']) as string) ?? ''} onChange={(v) => ctl.set([...R, 'fingerprint'], v)} options={UTLS_OPTIONS} />
      </Field>
      <Field label={t('pages.xray.outboundForm.shortId')}>
        <Input value={ctl.get([...R, 'shortId']) ?? ''} onChange={(e) => ctl.set([...R, 'shortId'], e.target.value)} />
      </Field>
      <Field label={t('pages.inbounds.form.spiderX')}>
        <Input value={ctl.get([...R, 'spiderX']) ?? ''} onChange={(e) => ctl.set([...R, 'spiderX'], e.target.value)} />
      </Field>
      <Field label={t('pages.inbounds.publicKey')}>
        <Textarea rows={2} value={ctl.get([...R, 'publicKey']) ?? ''} onChange={(e) => ctl.set([...R, 'publicKey'], e.target.value)} />
      </Field>
      <Field label={t('pages.inbounds.form.mldsa65Verify')}>
        <Textarea rows={2} value={ctl.get([...R, 'mldsa65Verify']) ?? ''} onChange={(e) => ctl.set([...R, 'mldsa65Verify'], e.target.value)} />
      </Field>
    </>
  );
}
