import { lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FilterOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  MoreOutlined,
  PlusOutlined,
  QrcodeOutlined,
  RestOutlined,
  RetweetOutlined,
  SearchOutlined,
  TagsOutlined,
  TeamOutlined,
  UsergroupAddOutlined,
  UsergroupDeleteOutlined,
} from '@ant-design/icons';

import {
  Button,
  Card,
  DataTable,
  Dialog,
  DropdownMenu,
  Input,
  Pagination,
  Popover,
  Select,
  Stat,
  Switch,
  Tag,
  Tooltip,
  TooltipProvider,
  type ColumnDef,
  type MenuEntry,
  type TagTone,
} from '@/components/ds';
import { Spin } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useClients } from '@/hooks/useClients';
import { useDatepicker } from '@/hooks/useDatepicker';
import type { ClientRecord, InboundOption } from '@/hooks/useClients';
import { IntlUtil, SizeFormatter } from '@/utils';
import { getMessage } from '@/utils/messageBus';
import { LazyMount } from '@/components/utility';
const ClientFormModal = lazy(() => import('./ClientFormModal'));
const ClientInfoModal = lazy(() => import('./ClientInfoModal'));
const ClientQrModal = lazy(() => import('./ClientQrModal'));
const ClientBulkAddModal = lazy(() => import('./ClientBulkAddModal'));
const ClientBulkAdjustModal = lazy(() => import('./ClientBulkAdjustModal'));
const FilterDrawer = lazy(() => import('./FilterDrawer'));
const SubLinksModal = lazy(() => import('./SubLinksModal'));
const BulkAddToGroupModal = lazy(() => import('./BulkAddToGroupModal'));
const BulkAttachInboundsModal = lazy(() => import('./BulkAttachInboundsModal'));
const BulkDetachInboundsModal = lazy(() => import('./BulkDetachInboundsModal'));
import { emptyFilters, activeFilterCount } from './filters';
import type { ClientFilters } from './filters';
import './ClientsPage.css';

const FILTER_STATE_KEY = 'clientsFilterState';
const DISABLED_PAGE_SIZE = 200;

function tone(c?: string): TagTone {
  switch (c) {
    case 'green': case 'lime': return 'success';
    case 'red': case 'magenta': case 'volcano': return 'danger';
    case 'gold': case 'orange': return 'warning';
    case 'blue': case 'geekblue': case 'cyan': case 'purple': return 'primary';
    default: return 'neutral';
  }
}

function UngroupIcon() {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '1em', height: '1em' }}>
      <TagsOutlined />
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
        <span style={{ display: 'block', width: '125%', height: '1.5px', background: 'currentColor', transform: 'rotate(-45deg)', borderRadius: '1px' }} />
      </span>
    </span>
  );
}

type Bucket = 'active' | 'deactive' | 'depleted' | 'expiring';

interface PersistedFilterState {
  searchKey: string;
  filters: ClientFilters;
  sort: string;
}

const INBOUND_PROTOCOL_COLORS: Record<string, string> = {
  vless: 'blue', vmess: 'geekblue', trojan: 'volcano', shadowsocks: 'magenta',
  hysteria: 'cyan', hysteria2: 'green', wireguard: 'gold', http: 'purple', mixed: 'lime', tunnel: 'orange',
};
const INBOUND_CHIP_LIMIT = 1;

function readFilterState(): PersistedFilterState {
  try {
    const raw = JSON.parse(localStorage.getItem(FILTER_STATE_KEY) || '{}');
    const fromRaw = (raw.filters ?? {}) as Partial<ClientFilters>;
    return {
      searchKey: typeof raw.searchKey === 'string' ? raw.searchKey : '',
      filters: {
        ...emptyFilters(),
        ...fromRaw,
        buckets: Array.isArray(fromRaw.buckets) ? fromRaw.buckets : [],
        protocols: Array.isArray(fromRaw.protocols) ? fromRaw.protocols : [],
        inboundIds: Array.isArray(fromRaw.inboundIds) ? fromRaw.inboundIds : [],
        groups: Array.isArray(fromRaw.groups) ? fromRaw.groups : [],
      },
      sort: typeof raw.sort === 'string' ? raw.sort : '',
    };
  } catch {
    return { searchKey: '', filters: emptyFilters(), sort: '' };
  }
}

function gbToBytes(gb: number | undefined): number {
  if (!gb || gb <= 0) return 0;
  return Math.round(gb * 1024 * 1024 * 1024);
}

const SORT_OPTIONS: { value: string; column: string; order: 'ascend' | 'descend'; labelKey: string }[] = [
  { value: 'createdAt:ascend', column: 'createdAt', order: 'ascend', labelKey: 'pages.clients.sortOldest' },
  { value: 'createdAt:descend', column: 'createdAt', order: 'descend', labelKey: 'pages.clients.sortNewest' },
  { value: 'updatedAt:descend', column: 'updatedAt', order: 'descend', labelKey: 'pages.clients.sortRecentlyUpdated' },
  { value: 'lastOnline:descend', column: 'lastOnline', order: 'descend', labelKey: 'pages.clients.sortRecentlyOnline' },
  { value: 'email:ascend', column: 'email', order: 'ascend', labelKey: 'pages.clients.sortEmailAZ' },
  { value: 'email:descend', column: 'email', order: 'descend', labelKey: 'pages.clients.sortEmailZA' },
  { value: 'traffic:descend', column: 'traffic', order: 'descend', labelKey: 'pages.clients.sortMostTraffic' },
  { value: 'remaining:descend', column: 'remaining', order: 'descend', labelKey: 'pages.clients.sortHighestRemaining' },
  { value: 'expiryTime:ascend', column: 'expiryTime', order: 'ascend', labelKey: 'pages.clients.sortExpiringSoonest' },
];
const DEFAULT_SORT = SORT_OPTIONS[0];

function sortValueFor(column: string | null, order: 'ascend' | 'descend' | null): string {
  if (!column || !order) return DEFAULT_SORT.value;
  return `${column}:${order}`;
}

function bucketChipLabel(b: string, t: (k: string) => string): string {
  switch (b) {
    case 'active': return t('subscription.active');
    case 'expiring': return t('depletingSoon');
    case 'depleted': return t('depleted');
    case 'deactive': return t('disabled');
    case 'online': return t('online');
    default: return b;
  }
}

interface ConfirmState {
  title: string;
  content: string;
  okText: string;
  onOk: () => void | Promise<void>;
}

export default function ClientsPage() {
  const { t } = useTranslation();
  const { isDark, isUltra } = useTheme();
  const { datepicker } = useDatepicker();
  const { isMobile } = useMediaQuery();
  const message = getMessage();

  const {
    clients, total, filtered,
    summary: serverSummary,
    allGroups,
    setQuery,
    inbounds, onlines, loading, fetched, fetchError, subSettings,
    ipLimitEnable, tgBotEnable, expireDiff, trafficDiff, pageSize,
    create, update, remove, bulkDelete, bulkAdjust, bulkAddToGroup, bulkRemoveFromGroup, attach, bulkAttach, detach, bulkDetach,
    resetTraffic, resetAllTraffics, delDepleted, setEnable,
    applyTrafficEvent, applyClientStatsEvent,
    refresh,
    hydrate,
  } = useClients();

  useWebSocket({ traffic: applyTrafficEvent, client_stats: applyClientStatsEvent });

  const [togglingEmail, setTogglingEmail] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null);
  const [editingAttachedIds, setEditingAttachedIds] = useState<number[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoClient, setInfoClient] = useState<ClientRecord | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrClient, setQrClient] = useState<ClientRecord | null>(null);
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkAdjustOpen, setBulkAdjustOpen] = useState(false);
  const [subLinksOpen, setSubLinksOpen] = useState(false);
  const [bulkGroupOpen, setBulkGroupOpen] = useState(false);
  const [bulkAttachOpen, setBulkAttachOpen] = useState(false);
  const [bulkDetachOpen, setBulkDetachOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const initial = readFilterState();
  const [searchKey, setSearchKey] = useState(initial.searchKey);
  const [filters, setFilters] = useState<ClientFilters>(initial.filters);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const initialSort = SORT_OPTIONS.find((o) => o.value === initial.sort) ?? DEFAULT_SORT;
  const [sortColumn, setSortColumn] = useState<string | null>(initialSort.column);
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend' | null>(initialSort.order);
  const [currentPage, setCurrentPage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(25);
  const [debouncedSearch, setDebouncedSearch] = useState(searchKey);

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  function runConfirm() {
    if (!confirm) return;
    setConfirmBusy(true);
    Promise.resolve(confirm.onOk()).finally(() => { setConfirmBusy(false); setConfirm(null); });
  }

  useEffect(() => {
    localStorage.setItem(FILTER_STATE_KEY, JSON.stringify({ searchKey, filters, sort: sortValueFor(sortColumn, sortOrder) }));
  }, [searchKey, filters, sortColumn, sortOrder]);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(searchKey), 300);
    return () => window.clearTimeout(handle);
  }, [searchKey]);

  useEffect(() => { setCurrentPage(1); }, [debouncedSearch, filters, sortColumn, sortOrder]);

  useEffect(() => {
    setQuery({
      page: currentPage,
      pageSize: tablePageSize,
      search: debouncedSearch,
      filter: filters.buckets.join(','),
      protocol: filters.protocols.join(','),
      inbound: filters.inboundIds.join(','),
      expiryFrom: filters.expiryFrom,
      expiryTo: filters.expiryTo,
      usageFrom: gbToBytes(filters.usageFromGB),
      usageTo: gbToBytes(filters.usageToGB),
      autoRenew: filters.autoRenew || undefined,
      hasTgId: filters.hasTgId || undefined,
      hasComment: filters.hasComment || undefined,
      group: filters.groups.join(',') || undefined,
      sort: sortColumn || undefined,
      order: sortOrder || undefined,
    });
  }, [setQuery, currentPage, tablePageSize, debouncedSearch, filters, sortColumn, sortOrder]);

  const activeCount = activeFilterCount(filters);

  useEffect(() => { setTablePageSize(pageSize > 0 ? pageSize : DISABLED_PAGE_SIZE); }, [pageSize]);

  const onlineSet = useMemo(() => new Set(onlines || []), [onlines]);
  const inboundsById = useMemo(() => {
    const out: Record<number, InboundOption> = {};
    for (const ib of inbounds) out[ib.id] = ib;
    return out;
  }, [inbounds]);

  const protocolOptions = useMemo(() => {
    const values = new Set<string>((inbounds || []).map((i) => i.protocol).filter((x): x is string => !!x));
    return [...values].sort();
  }, [inbounds]);

  const groupOptions = useMemo(() => {
    const values = new Set<string>(allGroups);
    for (const g of filters.groups) values.add(g);
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [allGroups, filters.groups]);

  const isOnline = useCallback((email: string) => !!email && onlineSet.has(email), [onlineSet]);

  function inboundLabel(id: number) {
    const ib = inboundsById[id];
    return ib?.remark?.trim() || ib?.tag || '';
  }

  const clientBucket = useCallback((row: ClientRecord | null | undefined): Bucket | null => {
    if (!row) return null;
    const traffic = row.traffic || {};
    const used = (traffic.up || 0) + (traffic.down || 0);
    const total0 = row.totalGB || 0;
    const now = Date.now();
    const expired = (row.expiryTime ?? 0) > 0 && (row.expiryTime ?? 0) <= now;
    const exhausted = total0 > 0 && used >= total0;
    if (expired || exhausted) return 'depleted';
    if (!row.enable) return 'deactive';
    const nearExpiry = (row.expiryTime ?? 0) > 0 && (row.expiryTime ?? 0) - now < (expireDiff || 0);
    const nearLimit = total0 > 0 && total0 - used < (trafficDiff || 0);
    if (nearExpiry || nearLimit) return 'expiring';
    return 'active';
  }, [expireDiff, trafficDiff]);

  function bucketDotClass(bucket: Bucket | null): string {
    switch (bucket) {
      case 'depleted': return 'dot dot-red';
      case 'expiring': return 'dot dot-orange';
      case 'active': return 'dot dot-green';
      default: return 'dot dot-gray';
    }
  }

  const filteredClients = clients;
  const summary = serverSummary;
  const sortedClients = filteredClients;

  function trafficLabel(row: ClientRecord) {
    const t0 = row.traffic;
    if (!t0) return '-';
    const used = (t0.up || 0) + (t0.down || 0);
    const total0 = row.totalGB || 0;
    if (total0 <= 0) return `${SizeFormatter.sizeFormat(used)} / ∞`;
    return `${SizeFormatter.sizeFormat(used)} / ${SizeFormatter.sizeFormat(total0)}`;
  }
  function remainingLabel(row: ClientRecord) {
    const total0 = row.totalGB || 0;
    if (total0 <= 0) return '∞';
    const used = (row.traffic?.up || 0) + (row.traffic?.down || 0);
    const r = total0 - used;
    return r > 0 ? SizeFormatter.sizeFormat(r) : '0';
  }
  function remainingColor(row: ClientRecord): string {
    const total0 = row.totalGB || 0;
    if (total0 <= 0) return 'purple';
    const used = (row.traffic?.up || 0) + (row.traffic?.down || 0);
    const ratio = used / total0;
    if (ratio >= 1) return 'red';
    if (ratio >= 0.85) return 'orange';
    return 'green';
  }
  function expiryLabel(row: ClientRecord) {
    if (!row.expiryTime) return '∞';
    if (row.expiryTime < 0) { const days = Math.round(row.expiryTime / -86400000); return `${t('pages.clients.delayedStart')}: ${days}d`; }
    return IntlUtil.formatDate(row.expiryTime, datepicker);
  }
  function expiryRelative(row: ClientRecord) {
    if (!row.expiryTime) return '';
    if (row.expiryTime < 0) { const days = Math.round(row.expiryTime / -86400000); return `${days}d`; }
    return IntlUtil.formatRelativeTime(row.expiryTime);
  }
  function expiryColor(row: ClientRecord): string {
    if (!row.expiryTime) return 'purple';
    if (row.expiryTime < 0) return 'blue';
    const now = Date.now();
    if (row.expiryTime <= now) return 'red';
    if (row.expiryTime - now < 86400 * 1000 * 3) return 'orange';
    return 'green';
  }

  async function onToggleEnable(row: ClientRecord, next: boolean) {
    setTogglingEmail(row.email);
    try {
      const msg = await setEnable(row, next);
      if (!msg?.success) message.error(msg?.msg || t('somethingWentWrong'));
    } finally {
      setTogglingEmail(null);
    }
  }

  function onAdd() { setFormMode('add'); setEditingClient(null); setEditingAttachedIds([]); setFormOpen(true); }

  async function onEdit(row: ClientRecord) {
    setFormMode('edit');
    const full = await hydrate(row.email);
    const merged: ClientRecord = full ? { ...row, ...full.client } : { ...row };
    setEditingClient(merged);
    const ids = full?.inboundIds ?? (Array.isArray(row.inboundIds) ? row.inboundIds : []);
    setEditingAttachedIds([...ids]);
    setFormOpen(true);
  }

  function onDelete(row: ClientRecord) {
    setConfirm({
      title: t('pages.clients.deleteConfirmTitle', { email: row.email }),
      content: t('pages.clients.deleteConfirmContent'),
      okText: t('delete'),
      onOk: async () => { const msg = await remove(row.email); if (msg?.success) message.success(t('pages.clients.toasts.deleted')); },
    });
  }

  function onResetTraffic(row: ClientRecord) {
    if (!row?.email) { message.warning(t('pages.clients.resetNotPossible')); return; }
    setConfirm({
      title: `${t('pages.inbounds.resetTraffic')} — ${row.email}`,
      content: t('pages.inbounds.resetTrafficContent'),
      okText: t('reset'),
      onOk: async () => { const msg = await resetTraffic(row); if (msg?.success) message.success(t('pages.clients.toasts.trafficReset')); },
    });
  }

  async function onShowInfo(row: ClientRecord) {
    const full = await hydrate(row.email);
    setInfoClient(full ? { ...row, ...full.client, inboundIds: full.inboundIds } : row);
    setInfoOpen(true);
  }
  async function onShowQr(row: ClientRecord) {
    const full = await hydrate(row.email);
    setQrClient(full ? { ...row, ...full.client, inboundIds: full.inboundIds } : row);
    setQrOpen(true);
  }

  function onResetAllTraffics() {
    setConfirm({
      title: t('pages.clients.resetAllTrafficsTitle'),
      content: t('pages.clients.resetAllTrafficsContent'),
      okText: t('reset'),
      onOk: async () => { const msg = await resetAllTraffics(); if (msg?.success) message.success(t('pages.clients.toasts.allTrafficsReset')); },
    });
  }
  function onDelDepleted() {
    setConfirm({
      title: t('pages.clients.delDepletedConfirmTitle'),
      content: t('pages.clients.delDepletedConfirmContent'),
      okText: t('delete'),
      onOk: async () => { const msg = await delDepleted(); if (msg?.success) { const d = msg.obj?.deleted ?? 0; message.success(t('pages.clients.toasts.delDepleted', { count: d })); } },
    });
  }
  function onBulkUngroup() {
    const emails = [...selectedRowKeys];
    if (emails.length === 0) return;
    setConfirm({
      title: t('pages.clients.ungroupConfirmTitle', { count: emails.length }),
      content: t('pages.clients.ungroupConfirmContent'),
      okText: t('confirm'),
      onOk: async () => {
        const msg = await bulkRemoveFromGroup(emails);
        if (msg?.success) { setSelectedRowKeys([]); const affected = (msg.obj as { affected?: number } | undefined)?.affected ?? emails.length; message.success(t('pages.clients.ungroupSuccessToast', { count: affected })); }
      },
    });
  }
  function onBulkDelete() {
    const emails = [...selectedRowKeys];
    if (emails.length === 0) return;
    setConfirm({
      title: t('pages.clients.bulkDeleteConfirmTitle', { count: emails.length }),
      content: t('pages.clients.bulkDeleteConfirmContent'),
      okText: t('delete'),
      onOk: async () => {
        const msg = await bulkDelete(emails);
        setSelectedRowKeys([]);
        const ok = msg?.obj?.deleted ?? 0;
        const skipped = msg?.obj?.skipped ?? [];
        const failed = skipped.length;
        const firstError = skipped[0]?.reason ?? msg?.msg ?? '';
        if (failed === 0 && msg?.success) message.success(t('pages.clients.toasts.bulkDeleted', { count: ok }));
        else message.warning(firstError ? `${t('pages.clients.toasts.bulkDeletedMixed', { ok, failed })} — ${firstError}` : t('pages.clients.toasts.bulkDeletedMixed', { ok, failed }));
      },
    });
  }

  const onSave = useCallback(async (
    payload: Record<string, unknown> | { client: Record<string, unknown>; inboundIds: number[] },
    meta: { isEdit: false } | { isEdit: true; email: string; attach: number[]; detach: number[] },
  ) => {
    if (!meta.isEdit) return create(payload);
    const updateMsg = await update(meta.email, payload);
    if (!updateMsg?.success) return updateMsg;
    if (Array.isArray(meta.attach) && meta.attach.length > 0) { const r = await attach(meta.email, meta.attach); if (!r?.success) return r; }
    if (Array.isArray(meta.detach) && meta.detach.length > 0) { const r = await detach(meta.email, meta.detach); if (!r?.success) return r; }
    return updateMsg;
  }, [create, update, attach, detach]);

  const pageClass = useMemo(() => ['clients-page', isDark && 'is-dark', isUltra && 'is-ultra'].filter(Boolean).join(' '), [isDark, isUltra]);

  function inboundChip(id: number, compact: boolean) {
    const ib = inboundsById[id];
    const proto = (ib?.protocol || '').toLowerCase();
    const compactLabel = ib?.remark?.trim() || ib?.tag || '';
    return (
      <Tooltip key={id} title={inboundLabel(id)}>
        <Tag tone={tone(INBOUND_PROTOCOL_COLORS[proto] ?? 'default')} style={{ margin: 2 }}>
          {compact ? compactLabel : inboundLabel(id)}
        </Tag>
      </Tooltip>
    );
  }

  const columns = useMemo<ColumnDef<ClientRecord, unknown>[]>(() => {
    const cols: ColumnDef<ClientRecord, unknown>[] = [
      {
        id: 'actions', size: 200, header: () => t('pages.clients.actions'),
        cell: ({ row }) => {
          const record = row.original;
          return (
            <div style={{ display: 'flex', gap: 2 }}>
              <Tooltip title={t('pages.clients.qrCode')}><Button size="sm" variant="text" icon={<QrcodeOutlined />} onClick={() => onShowQr(record)} /></Tooltip>
              <Tooltip title={t('pages.clients.clientInfo')}><Button size="sm" variant="text" icon={<InfoCircleOutlined />} onClick={() => onShowInfo(record)} /></Tooltip>
              <Tooltip title={t('pages.inbounds.resetTraffic')}><Button size="sm" variant="text" icon={<RetweetOutlined />} onClick={() => onResetTraffic(record)} /></Tooltip>
              <Tooltip title={t('edit')}><Button size="sm" variant="text" icon={<EditOutlined />} onClick={() => onEdit(record)} /></Tooltip>
              <Tooltip title={t('delete')}><Button size="sm" variant="text" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)} /></Tooltip>
            </div>
          );
        },
      },
      {
        id: 'enable', size: 80, header: () => t('pages.clients.enabled'),
        cell: ({ row }) => <Switch checked={!!row.original.enable} onChange={(next) => onToggleEnable(row.original, next)} />,
      },
      {
        id: 'online', size: 100, header: () => t('pages.clients.online'),
        cell: ({ row }) => {
          const record = row.original;
          const bucket = clientBucket(record);
          const lastOnline = record.traffic?.lastOnline ?? 0;
          const title = `${t('lastOnline')}: ${lastOnline > 0 ? IntlUtil.formatDate(lastOnline, datepicker) : '-'}`;
          if (bucket === 'depleted') return <Tooltip title={title}><Tag tone="danger">{t('depleted')}</Tag></Tooltip>;
          if (record.enable && isOnline(record.email)) return <Tag tone="success"><span className="online-dot" />{t('pages.clients.online')}</Tag>;
          if (!record.enable) return <Tag>{t('disabled')}</Tag>;
          if (bucket === 'expiring') return <Tag tone="warning">{t('depletingSoon')}</Tag>;
          return <Tooltip title={title}><Tag>{t('pages.clients.offline')}</Tag></Tooltip>;
        },
      },
      {
        id: 'email', header: () => t('pages.clients.client'),
        cell: ({ row }) => (
          <div className="email-cell">
            <span className="email">{row.original.email}</span>
            {row.original.subId && <span className="sub" title={row.original.subId}>{row.original.subId}</span>}
            {row.original.comment && <span className="sub" title={row.original.comment}>{row.original.comment}</span>}
          </div>
        ),
      },
    ];
    if (allGroups.length > 0) {
      cols.push({
        id: 'group', size: 130, header: () => t('pages.clients.group'),
        cell: ({ row }) => {
          const record = row.original;
          if (!record.group) return <span className="ds-muted">—</span>;
          const isActive = filters.groups.includes(record.group);
          return (
            <Tag tone="primary" style={{ cursor: 'pointer', opacity: isActive ? 0.6 : 1 }} onClick={() => { if (!isActive) setFilters({ ...filters, groups: [...filters.groups, record.group!] }); }}>
              {record.group}
            </Tag>
          );
        },
      });
    }
    cols.push(
      {
        id: 'inboundIds', size: 170, header: () => t('pages.clients.attachedInbounds'),
        cell: ({ row }) => {
          const ids = row.original.inboundIds || [];
          if (ids.length === 0) return <span className="ds-muted">—</span>;
          const visible = ids.slice(0, INBOUND_CHIP_LIMIT);
          const overflow = ids.slice(INBOUND_CHIP_LIMIT);
          return (
            <>
              {visible.map((id) => inboundChip(id, true))}
              {overflow.length > 0 && (
                <Popover
                  side="bottom" align="end"
                  trigger={<button type="button" className="ds-tag chip-more" style={{ margin: 2, cursor: 'pointer' }}>+{overflow.length}</button>}
                  content={<div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 280, maxHeight: 280, overflowY: 'auto' }}>{overflow.map((id) => inboundChip(id, false))}</div>}
                />
              )}
            </>
          );
        },
      },
      { id: 'traffic', header: () => t('pages.clients.traffic'), cell: ({ row }) => trafficLabel(row.original) },
      { id: 'remaining', size: 130, header: () => t('pages.clients.remaining'), cell: ({ row }) => <Tag tone={tone(remainingColor(row.original))}>{remainingLabel(row.original)}</Tag> },
      {
        id: 'expiryTime', header: () => t('pages.clients.duration'),
        cell: ({ row }) => <Tooltip title={expiryLabel(row.original)}><Tag tone={tone(expiryColor(row.original))}>{row.original.expiryTime ? expiryRelative(row.original) : '∞'}</Tag></Tooltip>,
      },
    );
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, togglingEmail, clientBucket, isOnline, inboundsById, filters, allGroups, datepicker]);

  const moreItems = useMemo<MenuEntry[]>(() => (
    selectedRowKeys.length > 0
      ? [
          { key: 'adjust', icon: <ClockCircleOutlined />, label: t('pages.clients.adjust'), onSelect: () => setBulkAdjustOpen(true) },
          { key: 'subLinks', icon: <LinkOutlined />, label: t('pages.clients.subLinks'), onSelect: () => setSubLinksOpen(true) },
        ]
      : [
          { key: 'bulk', icon: <UsergroupAddOutlined />, label: t('pages.clients.bulk'), onSelect: () => setBulkAddOpen(true) },
          { key: 'resetAll', icon: <RetweetOutlined />, label: t('pages.clients.resetAllTraffics'), onSelect: onResetAllTraffics },
          { key: 'delDepleted', icon: <RestOutlined />, label: t('pages.clients.delDepleted'), danger: true, onSelect: onDelDepleted },
        ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [selectedRowKeys.length, t]);

  function selectAll(checked: boolean) { setSelectedRowKeys(checked ? filteredClients.map((c) => c.email) : []); }
  function toggleSelect(email: string, checked: boolean) {
    setSelectedRowKeys((prev) => { const next = new Set(prev); if (checked) next.add(email); else next.delete(email); return Array.from(next); });
  }
  const allSelected = filteredClients.length > 0 && selectedRowKeys.length === filteredClients.length;

  function clearOneFilter<K extends keyof ClientFilters>(key: K) {
    if (key === 'expiryFrom' || key === 'expiryTo') { setFilters({ ...filters, expiryFrom: undefined, expiryTo: undefined }); return; }
    if (key === 'usageFromGB' || key === 'usageToGB') { setFilters({ ...filters, usageFromGB: undefined, usageToGB: undefined }); return; }
    setFilters({ ...filters, [key]: emptyFilters()[key] });
  }

  function closableChip(key: string, t0: TagTone, label: React.ReactNode, onClose: () => void) {
    return (
      <Tag key={key} tone={t0}>
        {label}
        <span style={{ cursor: 'pointer', marginLeft: 6, fontWeight: 700 }} onClick={onClose}>×</span>
      </Tag>
    );
  }

  const pagination = {
    page: currentPage,
    pageSize: tablePageSize,
    total: filtered,
    pageSizeOptions: [10, 25, 50, 100, 200],
    onChange: (p: number, s: number) => { setCurrentPage(p); if (s !== tablePageSize) setTablePageSize(s); },
    showTotal: () => `${filtered}`,
  };

  function statWithList(title: string, value: number, dotClass: string, emails: string[]) {
    const stat = <Stat title={title} value={String(value)} prefix={<span className={dotClass} />} />;
    if (emails.length === 0) return stat;
    return (
      <Popover
        side="bottom"
        trigger={<button type="button" style={{ all: 'unset', cursor: 'pointer', display: 'block' }}>{stat}</button>}
        content={<div className="client-email-list">{emails.map((e) => <div key={e}>{e}</div>)}</div>}
      />
    );
  }

  return (
    <TooltipProvider>
      <div className={`section-content-wrapper clients-section-wrapper ${pageClass}`}>
        {!fetched ? (
          <div className="ds-table__empty">{t('loading')}</div>
        ) : fetchError ? (
          <Card>
            <div style={{ textAlign: 'center', padding: 24 }}>
              <h3>{t('somethingWentWrong')}</h3>
              <p className="ds-muted">{fetchError}</p>
              <Button variant="primary" loading={loading} onClick={refresh}>{t('refresh')}</Button>
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 12 }}>
            <Card>
              <div className="ds-stats-grid">
                <Stat title={t('clients')} value={String(summary.total)} prefix={<TeamOutlined />} />
                {statWithList(t('online'), summary.online.length, 'dot dot-blue', summary.online)}
                {statWithList(t('depleted'), summary.depleted.length, 'dot dot-red', summary.depleted)}
                {statWithList(t('depletingSoon'), summary.expiring.length, 'dot dot-orange', summary.expiring)}
                {statWithList(t('disabled'), summary.deactive.length, 'dot dot-gray', summary.deactive)}
                <Stat title={t('subscription.active')} value={String(summary.active)} prefix={<span className="dot dot-green" />} />
              </div>
            </Card>

            <Card flush>
              <div className="card-toolbar" style={{ padding: 12 }}>
                {selectedRowKeys.length === 0 ? (
                  <Button variant="primary" icon={<PlusOutlined />} onClick={onAdd}>{!isMobile && t('pages.clients.addClients')}</Button>
                ) : (
                  <>
                    {closableChip('sel', 'primary', t('pages.clients.selectedCount', { count: selectedRowKeys.length }), () => setSelectedRowKeys([]))}
                    <Button icon={<UsergroupAddOutlined />} onClick={() => setBulkAttachOpen(true)}>{!isMobile && t('pages.clients.attach')}</Button>
                    <Button danger icon={<UsergroupDeleteOutlined />} onClick={() => setBulkDetachOpen(true)}>{!isMobile && t('pages.clients.detach')}</Button>
                    <Button icon={<TagsOutlined />} onClick={() => setBulkGroupOpen(true)}>{!isMobile && t('pages.clients.addToGroup')}</Button>
                    <Button danger icon={<UngroupIcon />} onClick={onBulkUngroup}>{!isMobile && t('pages.clients.ungroup')}</Button>
                  </>
                )}
                <DropdownMenu items={moreItems} trigger={<Button icon={<MoreOutlined />}>{!isMobile && t('more')}</Button>} />
                {selectedRowKeys.length > 0 && (
                  <Button danger icon={<DeleteOutlined />} onClick={onBulkDelete} style={{ marginInlineStart: 'auto' }}>{!isMobile && t('delete')}</Button>
                )}
              </div>

              <div className={isMobile ? 'filter-bar mobile' : 'filter-bar'} style={{ padding: '0 12px 12px' }}>
                <div style={{ position: 'relative', maxWidth: 320, flex: 1 }}>
                  <SearchOutlined style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.45 }} />
                  <Input value={searchKey} onChange={(e) => setSearchKey(e.target.value)} placeholder={t('pages.clients.searchPlaceholder')} style={{ paddingLeft: 32 }} />
                </div>
                <Button icon={<FilterOutlined />} variant={activeCount > 0 ? 'primary' : 'default'} onClick={() => setFilterDrawerOpen(true)}>
                  {!isMobile && t('filter')}{activeCount > 0 ? ` (${activeCount})` : ''}
                </Button>
                <div style={{ minWidth: isMobile ? 140 : 210 }}>
                  <Select
                    value={sortValueFor(sortColumn, sortOrder)}
                    onChange={(value) => { const opt = SORT_OPTIONS.find((o) => o.value === value); setSortColumn(opt?.column ?? null); setSortOrder(opt?.order ?? null); }}
                    options={SORT_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                  />
                </div>
                {activeCount > 0 && <Button onClick={() => setFilters(emptyFilters())}>{t('pages.clients.clearAllFilters')}</Button>}
                {(activeCount > 0 || debouncedSearch.trim().length > 0) && (
                  <span className="filter-count">{t('pages.clients.showingCount', { shown: filtered, total })}</span>
                )}
              </div>

              {activeCount > 0 && (
                <div className="filter-chips" style={{ padding: '0 12px 12px' }}>
                  {filters.buckets.map((b) => closableChip(`b-${b}`, 'neutral', bucketChipLabel(b, t), () => setFilters({ ...filters, buckets: filters.buckets.filter((x) => x !== b) })))}
                  {filters.protocols.map((p) => closableChip(`p-${p}`, 'primary', p, () => setFilters({ ...filters, protocols: filters.protocols.filter((x) => x !== p) })))}
                  {filters.inboundIds.map((id) => closableChip(`i-${id}`, 'primary', inboundLabel(id), () => setFilters({ ...filters, inboundIds: filters.inboundIds.filter((x) => x !== id) })))}
                  {filters.groups.map((g) => closableChip(`g-${g}`, 'primary', `${t('pages.clients.group')}: ${g}`, () => setFilters({ ...filters, groups: filters.groups.filter((x) => x !== g) })))}
                  {(filters.expiryFrom || filters.expiryTo) && closableChip('exp', 'primary', `${t('pages.clients.expiryTime')}: ${filters.expiryFrom ? IntlUtil.formatDate(filters.expiryFrom, datepicker) : '…'} → ${filters.expiryTo ? IntlUtil.formatDate(filters.expiryTo, datepicker) : '…'}`, () => clearOneFilter('expiryFrom'))}
                  {(filters.usageFromGB || filters.usageToGB) && closableChip('usage', 'warning', `${t('pages.clients.traffic')}: ${filters.usageFromGB ?? 0}${filters.usageToGB ? `–${filters.usageToGB}` : '+'} GB`, () => clearOneFilter('usageFromGB'))}
                  {filters.autoRenew && closableChip('renew', 'warning', `${t('pages.clients.renew')}: ${filters.autoRenew === 'on' ? t('enabled') : t('disabled')}`, () => clearOneFilter('autoRenew'))}
                  {filters.hasTgId && closableChip('tg', 'neutral', `${t('pages.clients.telegramId')}: ${filters.hasTgId === 'yes' ? t('pages.clients.has') : t('pages.clients.hasNot')}`, () => clearOneFilter('hasTgId'))}
                  {filters.hasComment && closableChip('cm', 'neutral', `${t('pages.clients.comment')}: ${filters.hasComment === 'yes' ? t('pages.clients.has') : t('pages.clients.hasNot')}`, () => clearOneFilter('hasComment'))}
                </div>
              )}

              {!isMobile ? (
                <div style={{ padding: '0 4px 4px' }}>
                  <Spin spinning={loading}>
                    <DataTable
                      data={sortedClients}
                      columns={columns}
                      getRowId={(c) => c.email}
                      sortable={false}
                      rowSelection={{ selectedIds: selectedRowKeys, onChange: setSelectedRowKeys }}
                      pagination={pagination}
                      empty={<><TeamOutlined style={{ fontSize: 32, marginBottom: 8 }} /><div>{t('noData')}</div></>}
                    />
                  </Spin>
                </div>
              ) : (
                <Spin spinning={loading}>
                  <div className="client-cards" style={{ padding: '0 12px 12px' }}>
                    {filteredClients.length > 0 && (
                      <div className="card-bulk-bar">
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="checkbox" className="ds-check" checked={allSelected} onChange={(e) => selectAll(e.target.checked)} />
                          {t('pages.clients.selectAll')}
                        </label>
                        {selectedRowKeys.length > 0 && <span className="bulk-count">{selectedRowKeys.length}</span>}
                      </div>
                    )}
                    {filteredClients.length === 0 && (
                      <div className="card-empty"><TeamOutlined style={{ fontSize: 28, opacity: 0.5 }} /><div>{t('noData')}</div></div>
                    )}
                    {filteredClients.length > 0 && (
                      <div className="card-pagination"><Pagination {...pagination} /></div>
                    )}
                    {filteredClients.map((row) => {
                      const bucket = clientBucket(row);
                      return (
                        <div key={row.email} className={`client-card${selectedRowKeys.includes(row.email) ? ' is-selected' : ''}`}>
                          <div className="card-head">
                            <input type="checkbox" className="ds-check" checked={selectedRowKeys.includes(row.email)} onChange={(e) => toggleSelect(row.email, e.target.checked)} />
                            <span className={bucketDotClass(bucket)} />
                            <span className="tag-name">{row.email}</span>
                            {bucket === 'depleted' && <Tag tone="danger" className="status-tag">{t('depleted')}</Tag>}
                            {bucket === 'expiring' && <Tag tone="warning" className="status-tag">{t('depletingSoon')}</Tag>}
                            <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                              <Tooltip title={t('pages.clients.clientInfo')}>
                                <button type="button" className="row-action-trigger" onClick={() => onShowInfo(row)}><InfoCircleOutlined /></button>
                              </Tooltip>
                              <Switch checked={!!row.enable} onChange={(next) => onToggleEnable(row, next)} />
                              <DropdownMenu
                                items={[
                                  { key: 'qr', icon: <QrcodeOutlined />, label: t('pages.clients.qrCode'), onSelect: () => onShowQr(row) },
                                  { key: 'reset', icon: <RetweetOutlined />, label: t('pages.inbounds.resetTraffic'), onSelect: () => onResetTraffic(row) },
                                  { key: 'edit', icon: <EditOutlined />, label: t('edit'), onSelect: () => onEdit(row) },
                                  { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onSelect: () => onDelete(row) },
                                ]}
                                trigger={<button type="button" className="row-action-trigger"><MoreOutlined /></button>}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Spin>
              )}
            </Card>
          </div>
        )}

        <Dialog
          open={confirm !== null}
          onOpenChange={(o) => !o && setConfirm(null)}
          title={confirm?.title ?? ''}
          okText={confirm?.okText ?? t('confirm')}
          okDanger
          confirmLoading={confirmBusy}
          onOk={runConfirm}
        >
          <p style={{ margin: 0 }}>{confirm?.content}</p>
        </Dialog>

        <LazyMount when={formOpen}>
          <ClientFormModal open={formOpen} mode={formMode} client={editingClient} attachedIds={editingAttachedIds} inbounds={inbounds} ipLimitEnable={ipLimitEnable} tgBotEnable={tgBotEnable} groups={allGroups} save={onSave} onOpenChange={setFormOpen} />
        </LazyMount>
        <LazyMount when={infoOpen}>
          <ClientInfoModal open={infoOpen} client={infoClient} inboundsById={inboundsById} isOnline={infoClient ? isOnline(infoClient.email) : false} subSettings={subSettings} onOpenChange={setInfoOpen} />
        </LazyMount>
        <LazyMount when={qrOpen}>
          <ClientQrModal open={qrOpen} client={qrClient} subSettings={subSettings} onOpenChange={setQrOpen} />
        </LazyMount>
        <LazyMount when={bulkAddOpen}>
          <ClientBulkAddModal open={bulkAddOpen} inbounds={inbounds} ipLimitEnable={ipLimitEnable} groups={allGroups} onOpenChange={setBulkAddOpen} onSaved={() => setBulkAddOpen(false)} />
        </LazyMount>
        <LazyMount when={bulkAdjustOpen}>
          <ClientBulkAdjustModal open={bulkAdjustOpen} count={selectedRowKeys.length} onOpenChange={setBulkAdjustOpen} onSubmit={async (addDays, addBytes) => {
            const msg = await bulkAdjust([...selectedRowKeys], addDays, addBytes);
            if (msg?.success) { setSelectedRowKeys([]); return msg.obj ?? { adjusted: 0 }; }
            return null;
          }} />
        </LazyMount>
        <LazyMount when={subLinksOpen}>
          <SubLinksModal open={subLinksOpen} emails={selectedRowKeys} clients={clients} subSettings={subSettings} onOpenChange={setSubLinksOpen} />
        </LazyMount>
        <LazyMount when={bulkGroupOpen}>
          <BulkAddToGroupModal open={bulkGroupOpen} count={selectedRowKeys.length} groups={allGroups} onOpenChange={setBulkGroupOpen} onSubmit={async (group) => {
            const msg = await bulkAddToGroup([...selectedRowKeys], group);
            if (msg?.success) { setSelectedRowKeys([]); return (msg.obj as { affected?: number } | undefined) ?? { affected: 0 }; }
            return null;
          }} />
        </LazyMount>
        <LazyMount when={bulkAttachOpen}>
          <BulkAttachInboundsModal open={bulkAttachOpen} count={selectedRowKeys.length} inbounds={inbounds} onOpenChange={setBulkAttachOpen} onSubmit={async (inboundIds) => {
            const msg = await bulkAttach([...selectedRowKeys], inboundIds);
            if (msg?.success) { setSelectedRowKeys([]); return msg.obj ?? { attached: [], skipped: [], errors: [] }; }
            return null;
          }} />
        </LazyMount>
        <LazyMount when={bulkDetachOpen}>
          <BulkDetachInboundsModal open={bulkDetachOpen} count={selectedRowKeys.length} inbounds={inbounds} onOpenChange={setBulkDetachOpen} onSubmit={async (inboundIds) => {
            const msg = await bulkDetach([...selectedRowKeys], inboundIds);
            if (msg?.success) { setSelectedRowKeys([]); return msg.obj ?? { detached: [], skipped: [], errors: [] }; }
            return null;
          }} />
        </LazyMount>
        <LazyMount when={filterDrawerOpen}>
          <FilterDrawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen} filters={filters} onChange={setFilters} inbounds={inbounds} protocols={protocolOptions} groups={groupOptions} />
        </LazyMount>
      </div>
    </TooltipProvider>
  );
}
