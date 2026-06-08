import { useTranslation } from 'react-i18next';
import { Button, Field, Input, Select, Switch, Textarea } from '@/components/ds';
import { TagListEditor } from '@/components/form';
import { useFormCtl } from '@/lib/form/FormContext';
import { UTLS_FINGERPRINT } from '@/schemas/primitives';

const R = ['streamSettings', 'realitySettings'] as const;

interface RealityFormProps {
  saving: boolean;
  randomizeRealityTarget: () => void;
  randomizeShortIds: () => void;
  genRealityKeypair: () => void;
  clearRealityKeypair: () => void;
  genMldsa65: () => void;
  clearMldsa65: () => void;
}

export default function RealityForm({
  saving,
  randomizeRealityTarget,
  randomizeShortIds,
  genRealityKeypair,
  clearRealityKeypair,
  genMldsa65,
  clearMldsa65,
}: RealityFormProps) {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  return (
    <>
      <Field label={t('pages.inbounds.form.show')}>
        <Switch checked={!!ctl.get([...R, 'show'])} onChange={(v) => ctl.set([...R, 'show'], v)} />
      </Field>
      <Field label={t('pages.inbounds.form.xver')}>
        <Input type="number" min={0} value={ctl.get([...R, 'xver']) ?? ''} onChange={(e) => ctl.set([...R, 'xver'], Number(e.target.value) || 0)} />
      </Field>
      <Field label="uTLS">
        <Select
          value={(ctl.get([...R, 'settings', 'fingerprint']) as string) ?? ''}
          onChange={(v) => ctl.set([...R, 'settings', 'fingerprint'], v)}
          options={Object.values(UTLS_FINGERPRINT).map((fp) => ({ value: fp, label: fp }))}
        />
      </Field>
      <Field label={t('pages.inbounds.form.target')}>
        <div className="ifm-inline">
          <Input value={ctl.get([...R, 'target']) ?? ''} onChange={(e) => ctl.set([...R, 'target'], e.target.value)} />
          <Button variant="default" onClick={randomizeRealityTarget}>↻</Button>
        </div>
      </Field>
      <Field label="SNI">
        <TagListEditor value={ctl.get<string[]>([...R, 'serverNames'])} onChange={(v) => ctl.set([...R, 'serverNames'], v)} separators={[',']} />
      </Field>
      <Field label={t('pages.inbounds.form.maxTimeDiff')}>
        <Input type="number" min={0} value={ctl.get([...R, 'maxTimediff']) ?? ''} onChange={(e) => ctl.set([...R, 'maxTimediff'], Number(e.target.value) || 0)} />
      </Field>
      <Field label={t('pages.inbounds.form.minClientVer')}>
        <Input placeholder="25.9.11" value={ctl.get([...R, 'minClientVer']) ?? ''} onChange={(e) => ctl.set([...R, 'minClientVer'], e.target.value)} />
      </Field>
      <Field label={t('pages.inbounds.form.maxClientVer')}>
        <Input placeholder="25.9.11" value={ctl.get([...R, 'maxClientVer']) ?? ''} onChange={(e) => ctl.set([...R, 'maxClientVer'], e.target.value)} />
      </Field>
      <Field label={t('pages.inbounds.form.shortIds')}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <TagListEditor value={ctl.get<string[]>([...R, 'shortIds'])} onChange={(v) => ctl.set([...R, 'shortIds'], v)} separators={[',']} />
          </div>
          <Button variant="default" onClick={randomizeShortIds}>↻</Button>
        </div>
      </Field>
      <Field label={t('pages.inbounds.form.spiderX')}>
        <Input value={ctl.get([...R, 'settings', 'spiderX']) ?? ''} onChange={(e) => ctl.set([...R, 'settings', 'spiderX'], e.target.value)} />
      </Field>
      <Field label={t('pages.inbounds.publicKey')}>
        <Textarea rows={2} value={ctl.get([...R, 'settings', 'publicKey']) ?? ''} onChange={(e) => ctl.set([...R, 'settings', 'publicKey'], e.target.value)} />
      </Field>
      <Field label={t('pages.inbounds.privatekey')}>
        <Textarea rows={2} value={ctl.get([...R, 'privateKey']) ?? ''} onChange={(e) => ctl.set([...R, 'privateKey'], e.target.value)} />
      </Field>
      <Field label=" ">
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" loading={saving} onClick={genRealityKeypair}>{t('pages.inbounds.form.getNewCert')}</Button>
          <Button danger onClick={clearRealityKeypair}>{t('clear')}</Button>
        </div>
      </Field>
      <Field label={t('pages.inbounds.form.mldsa65Seed')}>
        <Textarea rows={3} value={ctl.get([...R, 'mldsa65Seed']) ?? ''} onChange={(e) => ctl.set([...R, 'mldsa65Seed'], e.target.value)} />
      </Field>
      <Field label={t('pages.inbounds.form.mldsa65Verify')}>
        <Textarea rows={3} value={ctl.get([...R, 'settings', 'mldsa65Verify']) ?? ''} onChange={(e) => ctl.set([...R, 'settings', 'mldsa65Verify'], e.target.value)} />
      </Field>
      <Field label=" ">
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" loading={saving} onClick={genMldsa65}>{t('pages.inbounds.form.getNewSeed')}</Button>
          <Button danger onClick={clearMldsa65}>{t('clear')}</Button>
        </div>
      </Field>
    </>
  );
}
