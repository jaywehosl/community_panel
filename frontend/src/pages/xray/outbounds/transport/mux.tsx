import { useTranslation } from 'react-i18next';
import { Field, Input, Select, Switch } from '@/components/ds';
import { useFormCtl } from '@/lib/form/FormContext';

import { isMuxAllowed } from '../outbound-form-helpers';

interface MuxFormProps {
  protocol: string;
  network: string;
}

export default function MuxForm({ protocol, network }: MuxFormProps) {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  const flow = (ctl.get(['settings', 'flow']) ?? '') as string;
  if (!isMuxAllowed(protocol, flow, network)) return null;
  const muxEnabled = !!ctl.get(['mux', 'enabled']);
  return (
    <>
      <Field label={t('pages.settings.mux')}>
        <Switch checked={muxEnabled} onChange={(v) => ctl.set(['mux', 'enabled'], v)} />
      </Field>
      {muxEnabled && (
        <>
          <Field label={t('pages.settings.subFormats.concurrency')}>
            <Input type="number" min={-1} max={1024} value={ctl.get(['mux', 'concurrency']) ?? ''} onChange={(e) => ctl.set(['mux', 'concurrency'], Number(e.target.value) || 0)} />
          </Field>
          <Field label={t('pages.settings.subFormats.xudpConcurrency')}>
            <Input type="number" min={-1} max={1024} value={ctl.get(['mux', 'xudpConcurrency']) ?? ''} onChange={(e) => ctl.set(['mux', 'xudpConcurrency'], Number(e.target.value) || 0)} />
          </Field>
          <Field label={t('pages.settings.subFormats.xudpUdp443')}>
            <Select value={(ctl.get(['mux', 'xudpProxyUDP443']) as string) ?? ''} onChange={(v) => ctl.set(['mux', 'xudpProxyUDP443'], v)} options={['reject', 'allow', 'skip'].map((v) => ({ value: v, label: v }))} />
          </Field>
        </>
      )}
    </>
  );
}
