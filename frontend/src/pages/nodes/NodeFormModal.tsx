import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, Button, Dialog, Field, Input, Select, Switch } from '@/components/ds';
import { getMessage } from '@/utils/messageBus';
import type { NodeRecord } from '@/api/queries/useNodesQuery';
import type { Msg } from '@/utils';
import { NodeFormSchema, type NodeFormValues, type ProbeResult } from '@/schemas/node';
import './NodeFormModal.css';

type Mode = 'add' | 'edit';

interface NodeFormModalProps {
  open: boolean;
  mode: Mode;
  node: NodeRecord | null;
  testConnection: (payload: Partial<NodeRecord>) => Promise<Msg<ProbeResult>>;
  fetchFingerprint: (payload: Partial<NodeRecord>) => Promise<Msg<string>>;
  save: (payload: Partial<NodeRecord>) => Promise<Msg<unknown>>;
  onOpenChange: (open: boolean) => void;
}

function defaultValues(): NodeFormValues {
  return {
    id: 0,
    name: '',
    remark: '',
    scheme: 'https',
    address: '',
    port: 2053,
    basePath: '/',
    apiToken: '',
    enable: true,
    allowPrivateAddress: false,
    tlsVerifyMode: 'verify',
    pinnedCertSha256: '',
  };
}

export default function NodeFormModal({
  open,
  mode,
  node,
  testConnection,
  fetchFingerprint,
  save,
  onOpenChange,
}: NodeFormModalProps) {
  const { t } = useTranslation();
  const message = getMessage();

  const [values, setValues] = useState<NodeFormValues>(defaultValues);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [fetchingPin, setFetchingPin] = useState(false);
  const [testResult, setTestResult] = useState<ProbeResult | null>(null);

  function set<K extends keyof NodeFormValues>(key: K, value: NodeFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    if (!open) return;
    const base = defaultValues();
    const next: NodeFormValues = mode === 'edit' && node
      ? { ...base, ...(node as unknown as Partial<NodeFormValues>), id: node.id, scheme: (node.scheme as 'http' | 'https') || base.scheme }
      : base;
    if (next.scheme === 'http') next.tlsVerifyMode = 'skip';
    setValues(next);
    setTestResult(null);
  }, [open, mode, node]);

  const title = useMemo(
    () => (mode === 'edit' ? t('pages.nodes.editNode') : t('pages.nodes.addNode')),
    [mode, t],
  );

  function buildPayload(v: NodeFormValues): Partial<NodeRecord> {
    return {
      id: v.id || 0,
      name: v.name.trim(),
      remark: v.remark?.trim() || '',
      scheme: v.scheme,
      address: v.address.trim(),
      port: v.port,
      basePath: v.basePath.trim() || '/',
      apiToken: v.apiToken.trim(),
      enable: v.enable,
      allowPrivateAddress: v.allowPrivateAddress,
      tlsVerifyMode: v.tlsVerifyMode,
      pinnedCertSha256: v.tlsVerifyMode === 'pin' ? v.pinnedCertSha256.trim() : '',
    };
  }

  function requireAddressPort(): boolean {
    if (!values.address.trim() || !values.port) {
      message.error(t('pages.nodes.toasts.fillRequired'));
      return false;
    }
    return true;
  }

  async function onTest() {
    if (!requireAddressPort()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const msg = await testConnection(buildPayload(values));
      setTestResult(msg?.success && msg.obj ? msg.obj : { status: 'offline', error: msg?.msg || 'unknown error' });
    } finally {
      setTesting(false);
    }
  }

  async function onFetchPin() {
    if (!requireAddressPort()) return;
    setFetchingPin(true);
    try {
      const msg = await fetchFingerprint(buildPayload(values));
      if (msg?.success && msg.obj) {
        set('pinnedCertSha256', msg.obj);
        message.success(t('pages.nodes.pinFetched'));
      } else {
        message.error(msg?.msg || t('pages.nodes.pinFetchFailed'));
      }
    } finally {
      setFetchingPin(false);
    }
  }

  async function submit() {
    const result = NodeFormSchema.safeParse(values);
    if (!result.success) {
      message.error(t(result.error.issues[0]?.message ?? 'pages.nodes.toasts.fillRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload(result.data);
      const test = await testConnection(payload);
      const probe = test?.success ? test.obj : null;
      if (!probe || probe.status !== 'online') {
        setTestResult(probe ?? { status: 'offline', error: test?.msg || t('pages.nodes.connectionFailed') });
        return;
      }
      setTestResult(probe);
      const msg = await save(payload);
      if (msg?.success) onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  function onSchemeChange(value: string) {
    set('scheme', value as 'http' | 'https');
    if (value === 'http') set('tlsVerifyMode', 'skip');
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => { if (!o && !submitting) onOpenChange(false); }}
      title={title}
      width={640}
      okText={t('save')}
      confirmLoading={submitting}
      onOk={submit}
    >
      <div className="node-form">
        <div className="node-form-grid cols-2">
          <Field label={t('pages.nodes.name')}>
            <Input value={values.name} onChange={(e) => set('name', e.target.value)} placeholder={t('pages.nodes.namePlaceholder')} />
          </Field>
          <Field label={t('pages.nodes.remark')}>
            <Input value={values.remark} onChange={(e) => set('remark', e.target.value)} />
          </Field>
        </div>

        <div className="node-form-grid cols-scheme">
          <Field label={t('pages.nodes.scheme')}>
            <Select
              value={values.scheme}
              onChange={onSchemeChange}
              options={[{ value: 'https', label: 'https' }, { value: 'http', label: 'http' }]}
            />
          </Field>
          <Field label={t('pages.nodes.address')}>
            <Input value={values.address} onChange={(e) => set('address', e.target.value)} placeholder={t('pages.nodes.addressPlaceholder')} />
          </Field>
          <Field label={t('pages.nodes.port')}>
            <Input
              type="number"
              min={1}
              max={65535}
              value={values.port}
              onChange={(e) => set('port', Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="node-form-grid cols-2">
          <Field label={t('pages.nodes.basePath')}>
            <Input value={values.basePath} onChange={(e) => set('basePath', e.target.value)} placeholder="/" />
          </Field>
          <Field label={t('pages.nodes.enable')}>
            <Switch checked={values.enable} onChange={(v) => set('enable', v)} />
          </Field>
        </div>

        <Field label={t('pages.nodes.allowPrivateAddress')}>
          <Switch checked={values.allowPrivateAddress} onChange={(v) => set('allowPrivateAddress', v)} />
          <span className="node-form-hint">{t('pages.nodes.allowPrivateAddressHint')}</span>
        </Field>

        <Field label={t('pages.nodes.tlsVerifyMode')}>
          <Select
            value={values.tlsVerifyMode}
            onChange={(v) => set('tlsVerifyMode', v as NodeFormValues['tlsVerifyMode'])}
            disabled={values.scheme === 'http'}
            options={[
              { value: 'verify', label: t('pages.nodes.tlsVerify') },
              { value: 'pin', label: t('pages.nodes.tlsPin') },
              { value: 'skip', label: t('pages.nodes.tlsSkip') },
            ]}
          />
          <span className="node-form-hint">{t('pages.nodes.tlsVerifyModeHint')}</span>
        </Field>

        {values.tlsVerifyMode === 'skip' && (
          <Alert tone="warning" style={{ marginBottom: 16 }} title={t('pages.nodes.tlsSkipWarning')} />
        )}

        {values.tlsVerifyMode === 'pin' && (
          <Field label={t('pages.nodes.pinnedCert')}>
            <div className="node-form-inline">
              <Input
                value={values.pinnedCertSha256}
                onChange={(e) => set('pinnedCertSha256', e.target.value)}
                placeholder={t('pages.nodes.pinnedCertPlaceholder')}
              />
              <Button loading={fetchingPin} onClick={onFetchPin}>{t('pages.nodes.fetchPin')}</Button>
            </div>
            <span className="node-form-hint">{t('pages.nodes.pinnedCertHint')}</span>
          </Field>
        )}

        <Field label={t('pages.nodes.apiToken')}>
          <Input
            type="password"
            value={values.apiToken}
            onChange={(e) => set('apiToken', e.target.value)}
            placeholder={t('pages.nodes.apiTokenPlaceholder')}
          />
          <span className="node-form-hint">{t('pages.nodes.apiTokenHint')}</span>
        </Field>

        <div className="test-row">
          <Button loading={testing} onClick={onTest}>{t('pages.nodes.testConnection')}</Button>
          {testResult && (
            <div className="test-result">
              {testResult.status === 'online' ? (
                <Alert
                  tone="success"
                  title={t('pages.nodes.connectionOk', { ms: testResult.latencyMs })}
                  description={testResult.xrayVersion ? `Xray ${testResult.xrayVersion}` : undefined}
                />
              ) : (
                <Alert tone="error" title={t('pages.nodes.connectionFailed')} description={testResult.error} />
              )}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
