import { useTranslation } from 'react-i18next';
import { Field, Input, Select, Switch } from '@/components/ds';
import { HeaderMapEditor } from '@/components/form';
import { useFormCtl } from '@/lib/form/FormContext';

import { MODE_OPTIONS } from '../outbound-form-constants';

const X = ['streamSettings', 'xhttpSettings'] as const;
const XM = [...X, 'xmux'] as const;

const PLACEMENT_OPTIONS = [
  { value: '', label: 'Default (path)' },
  { value: 'path', label: 'path' },
  { value: 'header', label: 'header' },
  { value: 'cookie', label: 'cookie' },
  { value: 'query', label: 'query' },
];

interface XhttpFormProps {
  onXmuxToggle: (checked: boolean) => void;
}

export default function XhttpForm({ onXmuxToggle }: XhttpFormProps) {
  const { t } = useTranslation();
  const ctl = useFormCtl();

  const mode = (ctl.get([...X, 'mode']) as string) ?? '';
  const obfs = !!ctl.get([...X, 'xPaddingObfsMode']);
  const sessionPlacement = (ctl.get([...X, 'sessionPlacement']) as string) ?? '';
  const seqPlacement = (ctl.get([...X, 'seqPlacement']) as string) ?? '';
  const uplinkDataPlacement = (ctl.get([...X, 'uplinkDataPlacement']) as string) ?? '';
  const enableXmux = !!ctl.get([...X, 'enableXmux']);

  return (
    <>
      <Field label={t('host')}>
        <Input value={ctl.get([...X, 'host']) ?? ''} onChange={(e) => ctl.set([...X, 'host'], e.target.value)} />
      </Field>
      <Field label={t('path')}>
        <Input value={ctl.get([...X, 'path']) ?? ''} onChange={(e) => ctl.set([...X, 'path'], e.target.value)} />
      </Field>
      <Field label={t('pages.inbounds.info.mode')}>
        <Select value={mode} onChange={(v) => ctl.set([...X, 'mode'], v)} options={MODE_OPTIONS} />
      </Field>
      <Field label={t('pages.inbounds.form.paddingBytes')}>
        <Input value={ctl.get([...X, 'xPaddingBytes']) ?? ''} onChange={(e) => ctl.set([...X, 'xPaddingBytes'], e.target.value)} />
      </Field>
      <Field label={t('pages.inbounds.form.headers')}>
        <HeaderMapEditor mode="v1" value={ctl.get([...X, 'headers'])} onChange={(v) => ctl.set([...X, 'headers'], v)} />
      </Field>

      <Field label={t('pages.inbounds.form.paddingObfsMode')}>
        <Switch checked={obfs} onChange={(v) => ctl.set([...X, 'xPaddingObfsMode'], v)} />
      </Field>
      {obfs && (
        <>
          <Field label={t('pages.inbounds.form.paddingKey')}>
            <Input placeholder="x_padding" value={ctl.get([...X, 'xPaddingKey']) ?? ''} onChange={(e) => ctl.set([...X, 'xPaddingKey'], e.target.value)} />
          </Field>
          <Field label={t('pages.inbounds.form.paddingHeader')}>
            <Input placeholder="X-Padding" value={ctl.get([...X, 'xPaddingHeader']) ?? ''} onChange={(e) => ctl.set([...X, 'xPaddingHeader'], e.target.value)} />
          </Field>
          <Field label={t('pages.inbounds.form.paddingPlacement')}>
            <Select
              value={(ctl.get([...X, 'xPaddingPlacement']) as string) ?? ''}
              onChange={(v) => ctl.set([...X, 'xPaddingPlacement'], v)}
              options={[
                { value: '', label: 'Default (queryInHeader)' },
                { value: 'queryInHeader', label: 'queryInHeader' },
                { value: 'header', label: 'header' },
                { value: 'cookie', label: 'cookie' },
                { value: 'query', label: 'query' },
              ]}
            />
          </Field>
          <Field label={t('pages.inbounds.form.paddingMethod')}>
            <Select
              value={(ctl.get([...X, 'xPaddingMethod']) as string) ?? ''}
              onChange={(v) => ctl.set([...X, 'xPaddingMethod'], v)}
              options={[
                { value: '', label: 'Default (repeat-x)' },
                { value: 'repeat-x', label: 'repeat-x' },
                { value: 'tokenish', label: 'tokenish' },
              ]}
            />
          </Field>
        </>
      )}

      <Field label={t('pages.inbounds.form.uplinkHttpMethod')}>
        <Select
          value={(ctl.get([...X, 'uplinkHTTPMethod']) as string) ?? ''}
          onChange={(v) => ctl.set([...X, 'uplinkHTTPMethod'], v)}
          options={[
            { value: '', label: 'Default (POST)' },
            { value: 'POST', label: 'POST' },
            { value: 'PUT', label: 'PUT' },
            { value: 'GET', label: 'GET (packet-up only)', disabled: mode !== 'packet-up' },
          ]}
        />
      </Field>

      <Field label={t('pages.inbounds.form.sessionPlacement')}>
        <Select value={sessionPlacement} onChange={(v) => ctl.set([...X, 'sessionPlacement'], v)} options={PLACEMENT_OPTIONS} />
      </Field>
      {sessionPlacement && sessionPlacement !== 'path' && (
        <Field label={t('pages.inbounds.form.sessionKey')}>
          <Input placeholder="x_session" value={ctl.get([...X, 'sessionKey']) ?? ''} onChange={(e) => ctl.set([...X, 'sessionKey'], e.target.value)} />
        </Field>
      )}
      <Field label={t('pages.inbounds.form.sequencePlacement')}>
        <Select value={seqPlacement} onChange={(v) => ctl.set([...X, 'seqPlacement'], v)} options={PLACEMENT_OPTIONS} />
      </Field>
      {seqPlacement && seqPlacement !== 'path' && (
        <Field label={t('pages.inbounds.form.sequenceKey')}>
          <Input placeholder="x_seq" value={ctl.get([...X, 'seqKey']) ?? ''} onChange={(e) => ctl.set([...X, 'seqKey'], e.target.value)} />
        </Field>
      )}

      {mode === 'packet-up' && (
        <>
          <Field label={t('pages.xray.outboundForm.minUploadInterval')}>
            <Input placeholder="30" value={ctl.get([...X, 'scMinPostsIntervalMs']) ?? ''} onChange={(e) => ctl.set([...X, 'scMinPostsIntervalMs'], e.target.value)} />
          </Field>
          <Field label={t('pages.xray.outboundForm.maxUploadSizeBytes')}>
            <Input placeholder="1000000" value={ctl.get([...X, 'scMaxEachPostBytes']) ?? ''} onChange={(e) => ctl.set([...X, 'scMaxEachPostBytes'], e.target.value)} />
          </Field>
          <Field label={t('pages.inbounds.form.uplinkDataPlacement')}>
            <Select
              value={uplinkDataPlacement}
              onChange={(v) => ctl.set([...X, 'uplinkDataPlacement'], v)}
              options={[
                { value: '', label: 'Default (body)' },
                { value: 'body', label: 'body' },
                { value: 'header', label: 'header' },
                { value: 'cookie', label: 'cookie' },
                { value: 'query', label: 'query' },
              ]}
            />
          </Field>
          {uplinkDataPlacement && uplinkDataPlacement !== 'body' && (
            <>
              <Field label={t('pages.inbounds.form.uplinkDataKey')}>
                <Input placeholder="x_data" value={ctl.get([...X, 'uplinkDataKey']) ?? ''} onChange={(e) => ctl.set([...X, 'uplinkDataKey'], e.target.value)} />
              </Field>
              <Field label={t('pages.xray.outboundForm.uplinkChunkSize')}>
                <Input type="number" min={0} placeholder="0 (unlimited)" value={ctl.get([...X, 'uplinkChunkSize']) ?? ''} onChange={(e) => ctl.set([...X, 'uplinkChunkSize'], Number(e.target.value) || 0)} />
              </Field>
            </>
          )}
        </>
      )}
      {(mode === 'stream-up' || mode === 'stream-one') && (
        <Field label={t('pages.xray.outboundForm.noGrpcHeader')}>
          <Switch checked={!!ctl.get([...X, 'noGRPCHeader'])} onChange={(v) => ctl.set([...X, 'noGRPCHeader'], v)} />
        </Field>
      )}

      <Field label="XMUX">
        <Switch checked={enableXmux} onChange={(v) => { ctl.set([...X, 'enableXmux'], v); onXmuxToggle(v); }} />
      </Field>
      {enableXmux && (
        <>
          <Field label={t('pages.xray.outboundForm.maxConcurrency')}>
            <Input placeholder="16-32" value={ctl.get([...XM, 'maxConcurrency']) ?? ''} onChange={(e) => ctl.set([...XM, 'maxConcurrency'], e.target.value)} />
          </Field>
          <Field label={t('pages.xray.outboundForm.maxConnections')}>
            <Input placeholder="0" value={ctl.get([...XM, 'maxConnections']) ?? ''} onChange={(e) => ctl.set([...XM, 'maxConnections'], e.target.value)} />
          </Field>
          <Field label={t('pages.xray.outboundForm.maxReuseTimes')}>
            <Input value={ctl.get([...XM, 'cMaxReuseTimes']) ?? ''} onChange={(e) => ctl.set([...XM, 'cMaxReuseTimes'], e.target.value)} />
          </Field>
          <Field label={t('pages.xray.outboundForm.maxRequestTimes')}>
            <Input placeholder="600-900" value={ctl.get([...XM, 'hMaxRequestTimes']) ?? ''} onChange={(e) => ctl.set([...XM, 'hMaxRequestTimes'], e.target.value)} />
          </Field>
          <Field label={t('pages.xray.outboundForm.maxReusableSecs')}>
            <Input placeholder="1800-3000" value={ctl.get([...XM, 'hMaxReusableSecs']) ?? ''} onChange={(e) => ctl.set([...XM, 'hMaxReusableSecs'], e.target.value)} />
          </Field>
          <Field label={t('pages.xray.outboundForm.keepAlivePeriod')}>
            <Input type="number" min={0} value={ctl.get([...XM, 'hKeepAlivePeriod']) ?? ''} onChange={(e) => ctl.set([...XM, 'hKeepAlivePeriod'], Number(e.target.value) || 0)} />
          </Field>
        </>
      )}
    </>
  );
}
