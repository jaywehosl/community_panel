import { useTranslation } from 'react-i18next';
import { Field, Input, Select, Switch } from '@/components/ds';
import { useFormCtl } from '@/lib/form/FormContext';

import { SS_METHOD_OPTIONS } from '../outbound-form-constants';

export default function ShadowsocksFields() {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  return (
    <>
      <Field label={t('password')}>
        <Input value={ctl.get(['settings', 'password']) ?? ''} onChange={(e) => ctl.set(['settings', 'password'], e.target.value)} />
      </Field>
      <Field label={t('encryption')}>
        <Select value={(ctl.get(['settings', 'method']) as string) ?? ''} onChange={(v) => ctl.set(['settings', 'method'], v)} options={SS_METHOD_OPTIONS} />
      </Field>
      <Field label={t('pages.xray.outboundForm.udpOverTcp')}>
        <Switch checked={!!ctl.get(['settings', 'uot'])} onChange={(v) => ctl.set(['settings', 'uot'], v)} />
      </Field>
      <Field label={t('pages.xray.outboundForm.uotVersion')}>
        <Input type="number" min={1} max={2} value={ctl.get(['settings', 'UoTVersion']) ?? ''} onChange={(e) => ctl.set(['settings', 'UoTVersion'], Number(e.target.value) || 0)} />
      </Field>
    </>
  );
}
