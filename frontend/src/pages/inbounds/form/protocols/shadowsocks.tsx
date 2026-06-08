import { useTranslation } from 'react-i18next';
import { Button, Field, Input, Select, Switch } from '@/components/ds';
import { useFormCtl } from '@/lib/form/FormContext';
import { RandomUtil } from '@/utils';
import { SSMethodSchema } from '@/schemas/protocols/shared/shadowsocks';

export default function ShadowsocksFields({ isSSWith2022 }: { isSSWith2022: boolean }) {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  return (
    <>
      <Field label={t('pages.inbounds.form.encryptionMethod')}>
        <Select
          value={(ctl.get(['settings', 'method']) as string) ?? ''}
          onChange={(v) => {
            ctl.set(['settings', 'method'], v);
            ctl.set(['settings', 'password'], RandomUtil.randomShadowsocksPassword(v));
          }}
          options={SSMethodSchema.options.map((m) => ({ value: m, label: m }))}
        />
      </Field>
      {isSSWith2022 && (
        <Field label={t('password')}>
          <div className="ifm-inline">
            <Input value={ctl.get(['settings', 'password']) ?? ''} onChange={(e) => ctl.set(['settings', 'password'], e.target.value)} />
            <Button
              variant="default"
              onClick={() => {
                const method = ctl.get<string>(['settings', 'method']);
                ctl.set(['settings', 'password'], RandomUtil.randomShadowsocksPassword(method));
              }}
            >↻</Button>
          </div>
        </Field>
      )}
      <Field label={t('pages.inbounds.network')}>
        <Select
          value={(ctl.get(['settings', 'network']) as string) ?? 'tcp,udp'}
          onChange={(v) => ctl.set(['settings', 'network'], v)}
          options={[
            { value: 'tcp,udp', label: 'TCP, UDP' },
            { value: 'tcp', label: 'TCP' },
            { value: 'udp', label: 'UDP' },
          ]}
        />
      </Field>
      <Field label="ivCheck">
        <Switch checked={!!ctl.get(['settings', 'ivCheck'])} onChange={(v) => ctl.set(['settings', 'ivCheck'], v)} />
      </Field>
    </>
  );
}
