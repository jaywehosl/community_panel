import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import { Button, Drawer, Field, Input, Segmented, Tag } from '@/components/ds';
import type { InboundOption } from '@/hooks/useClients';
import { emptyFilters, type ClientFilters } from './filters';

interface FilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: ClientFilters;
  onChange: (next: ClientFilters) => void;
  inbounds: InboundOption[];
  protocols: string[];
  groups: string[];
}

const BUCKET_KEYS = ['active', 'expiring', 'depleted', 'deactive', 'online'] as const;

function bucketLabel(key: string, t: (k: string) => string): string {
  switch (key) {
    case 'active': return t('subscription.active');
    case 'expiring': return t('depletingSoon');
    case 'depleted': return t('depleted');
    case 'deactive': return t('disabled');
    case 'online': return t('online');
    default: return key;
  }
}

export default function FilterDrawer({
  open,
  onOpenChange,
  filters,
  onChange,
  inbounds,
  protocols,
  groups,
}: FilterDrawerProps) {
  const { t } = useTranslation();

  function patch<K extends keyof ClientFilters>(key: K, value: ClientFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function toggleIn<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  const inboundOptions = useMemo(
    () => inbounds.map((ib) => ({ value: ib.id, label: ib.remark?.trim() || ib.tag || '' })),
    [inbounds],
  );

  const fromStr = filters.expiryFrom ? dayjs(filters.expiryFrom).format('YYYY-MM-DD') : '';
  const toStr = filters.expiryTo ? dayjs(filters.expiryTo).format('YYYY-MM-DD') : '';

  const triState = [
    { value: '', label: t('all') },
    { value: 'yes', label: t('pages.clients.has') },
    { value: 'no', label: t('pages.clients.hasNot') },
  ];

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={t('pages.clients.filterTitle')}
      width={440}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <Button danger onClick={() => onChange(emptyFilters())}>{t('pages.clients.clearAllFilters')}</Button>
          <Button variant="primary" onClick={() => onOpenChange(false)}>{t('done')}</Button>
        </div>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label={t('status')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {BUCKET_KEYS.map((k) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  className="ds-check"
                  checked={filters.buckets.includes(k)}
                  onChange={() => patch('buckets', toggleIn(filters.buckets, k))}
                />
                {bucketLabel(k, t)}
              </label>
            ))}
          </div>
        </Field>

        <Field label={t('pages.inbounds.protocol')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {protocols.map((p) => (
              <Tag key={p} tone={filters.protocols.includes(p) ? 'primary' : 'neutral'} onClick={() => patch('protocols', toggleIn(filters.protocols, p))} style={{ cursor: 'pointer' }}>
                {p}
              </Tag>
            ))}
          </div>
        </Field>

        <Field label={t('inbounds')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
            {inboundOptions.map((o) => (
              <Tag key={o.value} tone={filters.inboundIds.includes(o.value) ? 'primary' : 'neutral'} onClick={() => patch('inboundIds', toggleIn(filters.inboundIds, o.value))} style={{ cursor: 'pointer' }}>
                {o.label}
              </Tag>
            ))}
          </div>
        </Field>

        <Field label={t('pages.clients.group')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
            {groups.map((g) => (
              <Tag key={g} tone={filters.groups.includes(g) ? 'primary' : 'neutral'} onClick={() => patch('groups', toggleIn(filters.groups, g))} style={{ cursor: 'pointer' }}>
                {g}
              </Tag>
            ))}
          </div>
        </Field>

        <Field label={t('pages.clients.expiryTime')}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input type="date" value={fromStr} onChange={(e) => onChange({ ...filters, expiryFrom: e.target.value ? dayjs(e.target.value).startOf('day').valueOf() : undefined })} />
            <Input type="date" value={toStr} onChange={(e) => onChange({ ...filters, expiryTo: e.target.value ? dayjs(e.target.value).endOf('day').valueOf() : undefined })} />
          </div>
        </Field>

        <Field label={`${t('pages.clients.traffic')} (GB)`}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input type="number" min={0} step={1} placeholder={t('from')} value={filters.usageFromGB ?? ''} onChange={(e) => patch('usageFromGB', e.target.value === '' ? undefined : Number(e.target.value))} />
            <Input type="number" min={0} step={1} placeholder={t('to')} value={filters.usageToGB ?? ''} onChange={(e) => patch('usageToGB', e.target.value === '' ? undefined : Number(e.target.value))} />
          </div>
        </Field>

        <Field label={t('pages.clients.renew')}>
          <Segmented
            value={filters.autoRenew}
            onChange={(v) => patch('autoRenew', v as ClientFilters['autoRenew'])}
            options={[{ value: '', label: t('all') }, { value: 'on', label: t('enabled') }, { value: 'off', label: t('disabled') }]}
          />
        </Field>

        <Field label={t('pages.clients.telegramId')}>
          <Segmented value={filters.hasTgId} onChange={(v) => patch('hasTgId', v as ClientFilters['hasTgId'])} options={triState} />
        </Field>

        <Field label={t('pages.clients.comment')}>
          <Segmented value={filters.hasComment} onChange={(v) => patch('hasComment', v as ClientFilters['hasComment'])} options={triState} />
        </Field>
      </div>
    </Drawer>
  );
}
