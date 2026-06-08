import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';

import { Button, Dialog, Field, Input, Select, Switch, Tag } from '@/components/ds';
import { getMessage } from '@/utils/messageBus';
import { RandomUtil } from '@/utils';
import { clientsApi } from '@/generated/client';
import { DateTimePicker } from '@/components/form';
import { TLS_FLOW_CONTROL } from '@/schemas/primitives';
import type { ClientRecord, InboundOption } from '@/hooks/useClients';
import { ClientFormSchema, ClientCreateFormSchema } from '@/schemas/client';

const FLOW_OPTIONS = Object.values(TLS_FLOW_CONTROL);
const VMESS_SECURITY_OPTIONS = ['auto', 'aes-128-gcm', 'chacha20-poly1305', 'none', 'zero'] as const;
const MULTI_CLIENT_PROTOCOLS = new Set(['shadowsocks', 'vless', 'vmess', 'trojan', 'hysteria']);

interface ApiMsg<T = unknown> { success?: boolean; obj?: T }
type Mode = 'add' | 'edit';
interface SaveMetaEdit { isEdit: true; email: string; attach: number[]; detach: number[] }
interface SaveMetaCreate { isEdit: false }
interface SaveCreatePayload { client: Record<string, unknown>; inboundIds: number[] }

interface ClientFormModalProps {
  open: boolean;
  mode: Mode;
  client: ClientRecord | null;
  inbounds: InboundOption[];
  attachedIds?: number[];
  ipLimitEnable?: boolean;
  tgBotEnable?: boolean;
  groups?: string[];
  save: (payload: Record<string, unknown> | SaveCreatePayload, meta: SaveMetaEdit | SaveMetaCreate) => Promise<ApiMsg | null>;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  email: string; subId: string; uuid: string; password: string; auth: string;
  flow: string; security: string; reverseTag: string; totalGB: number;
  expiryDate: Dayjs | null; delayedStart: boolean; delayedDays: number;
  reset: number; limitIp: number; tgId: number; group: string; comment: string;
  enable: boolean; inboundIds: number[];
}

function emptyForm(): FormState {
  return {
    email: '', subId: '', uuid: '', password: '', auth: '', flow: '', security: 'auto',
    reverseTag: '', totalGB: 0, expiryDate: null, delayedStart: false, delayedDays: 0,
    reset: 0, limitIp: 0, tgId: 0, group: '', comment: '', enable: true, inboundIds: [],
  };
}

function bytesToGB(bytes: number): number {
  if (!bytes || bytes <= 0) return 0;
  return Math.round((bytes / (1024 * 1024 * 1024)) * 100) / 100;
}
function gbToBytes(gb: number): number {
  if (!gb || gb <= 0) return 0;
  return Math.round(gb * 1024 * 1024 * 1024);
}

export default function ClientFormModal({
  open,
  mode,
  client,
  inbounds,
  attachedIds = [],
  ipLimitEnable = false,
  tgBotEnable = false,
  groups = [],
  save,
  onOpenChange,
}: ClientFormModalProps) {
  const { t } = useTranslation();
  const message = getMessage();
  const isEdit = mode === 'edit';
  const groupListId = useId();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [clientIps, setClientIps] = useState<string[]>([]);
  const [ipsLoading, setIpsLoading] = useState(false);
  const [ipsClearing, setIpsClearing] = useState(false);
  const [ipsModalOpen, setIpsModalOpen] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function loadIps() {
    if (!isEdit || !client?.email) return;
    setIpsLoading(true);
    try {
      const msg = await clientsApi.ipsByEmail<unknown[]>(client.email, undefined, { silent: true });
      if (!msg?.success) { setClientIps([]); return; }
      const arr = Array.isArray(msg.obj) ? msg.obj : [];
      setClientIps(arr.filter((x): x is string => typeof x === 'string' && x.length > 0));
    } finally {
      setIpsLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setIpsModalOpen(false);
    if (isEdit && client) {
      const et = Number(client.expiryTime) || 0;
      const next: FormState = {
        ...emptyForm(),
        email: client.email || '', subId: client.subId || '', uuid: client.uuid || '',
        password: client.password || '', auth: client.auth || '', flow: client.flow || '',
        security: client.security || 'auto', reverseTag: client.reverse?.tag || '',
        totalGB: bytesToGB(client.totalGB || 0), reset: Number(client.reset) || 0,
        limitIp: client.limitIp || 0, tgId: Number(client.tgId) || 0, group: client.group || '',
        comment: client.comment || '', enable: !!client.enable,
        inboundIds: Array.isArray(attachedIds) ? [...attachedIds] : [],
      };
      if (et < 0) { next.delayedStart = true; next.delayedDays = Math.round(et / -86400000); next.expiryDate = null; }
      else { next.delayedStart = false; next.delayedDays = 0; next.expiryDate = et > 0 ? dayjs(et) : null; }
      setForm(next);
      void loadIps();
    } else {
      setForm({
        ...emptyForm(),
        email: RandomUtil.randomLowerAndNum(10), uuid: RandomUtil.randomUUID(),
        subId: RandomUtil.randomLowerAndNum(16), password: RandomUtil.randomLowerAndNum(16),
        auth: RandomUtil.randomLowerAndNum(16),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit]);

  const flowCapableIds = useMemo(() => { const s = new Set<number>(); for (const r of inbounds || []) if (r?.tlsFlowCapable) s.add(r.id); return s; }, [inbounds]);
  const vlessLikeIds = useMemo(() => { const s = new Set<number>(); for (const r of inbounds || []) if (r?.protocol === 'vless') s.add(r.id); return s; }, [inbounds]);
  const vmessIds = useMemo(() => { const s = new Set<number>(); for (const r of inbounds || []) if (r?.protocol === 'vmess') s.add(r.id); return s; }, [inbounds]);

  const showFlow = useMemo(() => (form.inboundIds || []).some((id) => flowCapableIds.has(id)), [form.inboundIds, flowCapableIds]);
  const showReverseTag = useMemo(() => (form.inboundIds || []).some((id) => vlessLikeIds.has(id)), [form.inboundIds, vlessLikeIds]);
  const showSecurity = useMemo(() => (form.inboundIds || []).some((id) => vmessIds.has(id)), [form.inboundIds, vmessIds]);

  useEffect(() => { if (!showFlow && form.flow) update('flow', ''); }, [showFlow, form.flow]);
  useEffect(() => { if (!showReverseTag && form.reverseTag) update('reverseTag', ''); }, [showReverseTag, form.reverseTag]);

  const inboundOptions = useMemo(
    () => (inbounds || []).filter((ib) => MULTI_CLIENT_PROTOCOLS.has(ib.protocol || '')).map((ib) => ({ label: ib.remark?.trim() || ib.tag || '', value: ib.id })),
    [inbounds],
  );

  function toggleInbound(id: number) {
    update('inboundIds', form.inboundIds.includes(id) ? form.inboundIds.filter((x) => x !== id) : [...form.inboundIds, id]);
  }

  function openIpsModal() { setIpsModalOpen(true); if (clientIps.length === 0) void loadIps(); }

  async function clearIps() {
    if (!isEdit || !client?.email) return;
    setIpsClearing(true);
    try {
      const msg = await clientsApi.clearIpsByEmail(client.email, undefined, { silent: true });
      if (msg?.success) setClientIps([]);
    } finally {
      setIpsClearing(false);
    }
  }

  async function onSubmit() {
    const schema = isEdit ? ClientFormSchema : ClientCreateFormSchema;
    const validated = schema.safeParse({
      email: form.email, subId: form.subId, uuid: form.uuid, password: form.password, auth: form.auth,
      flow: form.flow, security: form.security, reverseTag: form.reverseTag, totalGB: form.totalGB,
      delayedStart: form.delayedStart, delayedDays: form.delayedDays, reset: form.reset, limitIp: form.limitIp,
      tgId: form.tgId, group: form.group, comment: form.comment, enable: form.enable, inboundIds: form.inboundIds,
    });
    if (!validated.success) {
      message.error(t(validated.error.issues[0]?.message ?? 'somethingWentWrong'));
      return;
    }
    const expiryTime = form.delayedStart ? -86400000 * (Number(form.delayedDays) || 0) : (form.expiryDate ? form.expiryDate.valueOf() : 0);
    const clientPayload: Record<string, unknown> = {
      email: form.email.trim(), subId: form.subId, id: form.uuid, password: form.password, auth: form.auth,
      flow: showFlow ? (form.flow || '') : '', security: showSecurity ? (form.security || 'auto') : 'auto',
      totalGB: gbToBytes(form.totalGB), expiryTime, reset: Number(form.reset) || 0, limitIp: Number(form.limitIp) || 0,
      tgId: Number(form.tgId) || 0, group: form.group, comment: form.comment, enable: !!form.enable,
    };
    const reverseTag = showReverseTag ? (form.reverseTag || '').trim() : '';
    if (reverseTag) clientPayload.reverse = { tag: reverseTag };

    setSubmitting(true);
    try {
      let msg;
      if (isEdit && client) {
        const original = new Set(attachedIds || []);
        const next = new Set(form.inboundIds || []);
        const toAttach = [...next].filter((id) => !original.has(id));
        const toDetach = [...original].filter((id) => !next.has(id));
        msg = await save(clientPayload, { isEdit: true, email: client.email, attach: toAttach, detach: toDetach });
      } else {
        msg = await save({ client: clientPayload, inboundIds: form.inboundIds }, { isEdit: false });
      }
      if (msg?.success) onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  const reloadInput = (value: string, onChange: (v: string) => void, regen: () => string) => (
    <div style={{ display: 'flex', gap: 8 }}>
      <Input value={value} style={{ flex: 1 }} onChange={(e) => onChange(e.target.value)} />
      <Button icon={<ReloadOutlined />} onClick={() => onChange(regen())} />
    </div>
  );

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => { if (!o && !submitting) onOpenChange(false); }}
        title={isEdit ? t('pages.clients.editClient') : t('pages.clients.addClient')}
        okText={isEdit ? t('save') : t('create')}
        confirmLoading={submitting}
        width={720}
        onOk={onSubmit}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label={t('pages.clients.email')}>{reloadInput(form.email, (v) => update('email', v), () => RandomUtil.randomLowerAndNum(12))}</Field>
            <Field label={t('pages.clients.subId')}>{reloadInput(form.subId, (v) => update('subId', v), () => RandomUtil.randomLowerAndNum(16))}</Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label={t('pages.clients.hysteriaAuth')}>{reloadInput(form.auth, (v) => update('auth', v), () => RandomUtil.randomLowerAndNum(16))}</Field>
            <Field label={t('pages.clients.password')}>{reloadInput(form.password, (v) => update('password', v), () => RandomUtil.randomLowerAndNum(16))}</Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: ipLimitEnable ? '2fr 1fr 1fr' : '1fr 1fr', gap: 14 }}>
            <Field label={t('pages.clients.uuid')}>{reloadInput(form.uuid, (v) => update('uuid', v), () => RandomUtil.randomUUID())}</Field>
            <Field label={t('pages.clients.totalGB')}>
              <Input type="number" min={0} step={1} value={form.totalGB} onChange={(e) => update('totalGB', Number(e.target.value) || 0)} />
            </Field>
            {ipLimitEnable && (
              <Field label={t('pages.clients.limitIp')}>
                <Input type="number" min={0} value={form.limitIp} onChange={(e) => update('limitIp', Number(e.target.value) || 0)} />
              </Field>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'end' }}>
            {form.delayedStart ? (
              <Field label={t('pages.clients.expireDays')}>
                <Input type="number" min={0} value={form.delayedDays} onChange={(e) => update('delayedDays', Number(e.target.value) || 0)} />
              </Field>
            ) : (
              <Field label={t('pages.clients.expiryTime')}>
                <DateTimePicker value={form.expiryDate} onChange={(d) => update('expiryDate', d || null)} />
              </Field>
            )}
            <Field label={t('pages.clients.delayedStart')}>
              <Switch checked={form.delayedStart} onChange={(v) => { update('delayedStart', v); if (v) update('expiryDate', null); else update('delayedDays', 0); }} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label={t('pages.clients.renew')}>
              <Input type="number" min={0} value={form.reset} onChange={(e) => update('reset', Number(e.target.value) || 0)} />
            </Field>
            {showReverseTag && (
              <Field label={t('pages.clients.reverseTag')}>
                <Input value={form.reverseTag} placeholder={t('pages.clients.reverseTagPlaceholder')} onChange={(e) => update('reverseTag', e.target.value)} />
              </Field>
            )}
            {showFlow && (
              <Field label={t('pages.clients.flow')}>
                <Select value={form.flow} onChange={(v) => update('flow', v)} options={[{ value: '', label: t('none') }, ...FLOW_OPTIONS.map((k) => ({ value: k, label: k }))]} />
              </Field>
            )}
            {showSecurity && (
              <Field label={t('pages.clients.vmessSecurity')}>
                <Select value={form.security} onChange={(v) => update('security', v)} options={VMESS_SECURITY_OPTIONS.map((k) => ({ value: k, label: k }))} />
              </Field>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {tgBotEnable && (
              <Field label={t('pages.clients.telegramId')}>
                <Input type="number" min={0} placeholder={t('pages.clients.telegramIdPlaceholder')} value={form.tgId} onChange={(e) => update('tgId', Number(e.target.value) || 0)} />
              </Field>
            )}
            <Field label={t('pages.clients.comment')}>
              <Input value={form.comment} onChange={(e) => update('comment', e.target.value)} />
            </Field>
            <Field label={t('pages.clients.group')}>
              <Input list={groupListId} value={form.group} placeholder={t('pages.clients.groupPlaceholder')} onChange={(e) => update('group', e.target.value)} />
              <datalist id={groupListId}>{groups.map((g) => <option key={g} value={g} />)}</datalist>
            </Field>
          </div>

          <Field label={t('pages.clients.attachedInbounds')}>
            {inboundOptions.length === 0 ? (
              <span className="ds-muted">—</span>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {inboundOptions.map((o) => (
                  <Tag key={o.value} tone={form.inboundIds.includes(o.value) ? 'primary' : 'neutral'} onClick={() => toggleInbound(o.value)} style={{ cursor: 'pointer' }}>
                    {o.label}
                  </Tag>
                ))}
              </div>
            )}
          </Field>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch checked={form.enable} onChange={(v) => update('enable', v)} />
            <span>{t('enable')}</span>
          </label>

          {isEdit && ipLimitEnable && (
            <Field label={t('pages.clients.ipLog')}>
              <Button icon={<EyeOutlined />} loading={ipsLoading} onClick={openIpsModal}>
                {clientIps.length > 0 ? clientIps.length : ''}
              </Button>
            </Field>
          )}
        </div>
      </Dialog>

      <Dialog
        open={ipsModalOpen}
        onOpenChange={(o) => !o && setIpsModalOpen(false)}
        title={`${t('pages.clients.ipLog')}${client?.email ? ` — ${client.email}` : ''}`}
        width={440}
        footer={(
          <>
            <Button icon={<ReloadOutlined />} loading={ipsLoading} onClick={loadIps}>{t('refresh')}</Button>
            <Button danger loading={ipsClearing} disabled={clientIps.length === 0} onClick={clearIps}>{t('pages.clients.clearAll')}</Button>
            <Button variant="primary" onClick={() => setIpsModalOpen(false)}>{t('close')}</Button>
          </>
        )}
      >
        {clientIps.length > 0 ? (
          <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {clientIps.map((ip, idx) => (
              <Tag key={idx} tone="primary" style={{ width: 'fit-content', maxWidth: '100%', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>{ip}</Tag>
            ))}
          </div>
        ) : (
          <Tag>{t('tgbot.noIpRecord')}</Tag>
        )}
      </Dialog>
    </>
  );
}
