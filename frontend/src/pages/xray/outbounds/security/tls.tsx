import { useTranslation } from 'react-i18next';
import { Field, Input, Select } from '@/components/ds';
import { TagListEditor } from '@/components/form';
import { useFormCtl } from '@/lib/form/FormContext';

import { ALPN_OPTIONS, UTLS_OPTIONS } from '../outbound-form-constants';

const TL = ['streamSettings', 'tlsSettings'] as const;

export default function TlsForm() {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  return (
    <>
      <Field label="SNI">
        <Input placeholder={t('pages.xray.outboundForm.serverNamePlaceholder')} value={ctl.get([...TL, 'serverName']) ?? ''} onChange={(e) => ctl.set([...TL, 'serverName'], e.target.value)} />
      </Field>
      <Field label="uTLS">
        <Select
          value={(ctl.get([...TL, 'fingerprint']) as string) ?? ''}
          onChange={(v) => ctl.set([...TL, 'fingerprint'], v)}
          options={[{ value: '', label: t('none') }, ...UTLS_OPTIONS]}
        />
      </Field>
      <Field label="ALPN">
        <TagListEditor value={ctl.get<string[]>([...TL, 'alpn'])} onChange={(v) => ctl.set([...TL, 'alpn'], v)} presets={ALPN_OPTIONS.map((o) => o.value)} separators={[',']} />
      </Field>
      <Field label="ECH">
        <Input value={ctl.get([...TL, 'echConfigList']) ?? ''} onChange={(e) => ctl.set([...TL, 'echConfigList'], e.target.value)} />
      </Field>
      <Field label={t('pages.xray.outboundForm.verifyPeerName')}>
        <Input placeholder="cloudflare-dns.com" value={ctl.get([...TL, 'verifyPeerCertByName']) ?? ''} onChange={(e) => ctl.set([...TL, 'verifyPeerCertByName'], e.target.value)} />
      </Field>
      <Field label={t('pages.xray.outboundForm.pinnedSha256')}>
        <Input placeholder="base64 SHA256" value={ctl.get([...TL, 'pinnedPeerCertSha256']) ?? ''} onChange={(e) => ctl.set([...TL, 'pinnedPeerCertSha256'], e.target.value)} />
      </Field>
    </>
  );
}
