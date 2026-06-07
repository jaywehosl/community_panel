import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClusterOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  MoreOutlined,
  PlusOutlined,
  RightOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

import {
  Button,
  Card,
  DataTable,
  Dialog,
  DropdownMenu,
  Switch,
  Tag,
  Tooltip,
  TooltipProvider,
  type ColumnDef,
  type MenuEntry,
} from '@/components/ds';
import NodeHistoryPanel from './NodeHistoryPanel';
import type { NodeRecord } from '@/api/queries/useNodesQuery';
import { isPanelUpdateAvailable } from '@/lib/panel-version';
import './NodeList.css';

interface NodeListProps {
  nodes: NodeRecord[];
  loading?: boolean;
  isMobile?: boolean;
  latestVersion?: string;
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onAdd: () => void;
  onEdit: (node: NodeRecord) => void;
  onDelete: (node: NodeRecord) => void;
  onProbe: (node: NodeRecord) => void;
  onToggleEnable: (node: NodeRecord, next: boolean) => void;
  onUpdateNode: (node: NodeRecord) => void;
  onUpdateSelected: () => void;
}

function isUpdateEligible(n: NodeRecord): boolean {
  return !!n.enable && n.status === 'online';
}

interface NodeRow extends NodeRecord {
  url: string;
  key: number;
}

/** Inline horizontal stack (replaces antd <Space>). */
function HStack({ gap = 8, children }: { gap?: number; children: ReactNode }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap }}>{children}</span>;
}

function StatusDot({ status }: { status?: string }) {
  if (status === 'online') return <span className="online-dot" />;
  const color = status === 'offline' ? 'var(--color-error)' : 'var(--text-3)';
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color }} />;
}

function StatusLabel({ status }: { status?: string }) {
  const { t } = useTranslation();
  return (
    <span style={status === 'online' ? { color: 'var(--color-success)' } : undefined}>
      {t(`pages.nodes.statusValues.${status || 'unknown'}`)}
    </span>
  );
}

function formatPct(p?: number): string {
  if (typeof p !== 'number' || Number.isNaN(p)) return '-';
  return `${p.toFixed(1)}%`;
}

function formatUptime(secs?: number): string {
  if (!secs) return '-';
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((secs % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function useRelativeTime() {
  const { t } = useTranslation();
  return (unixSeconds?: number) => {
    if (!unixSeconds) return t('pages.nodes.never');
    const diffSec = Math.max(0, Math.floor(Date.now() / 1000 - unixSeconds));
    if (diffSec < 5) return t('pages.nodes.justNow');
    if (diffSec < 60) return `${diffSec}s`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
    return `${Math.floor(diffSec / 86400)}d`;
  };
}

export default function NodeList({
  nodes,
  isMobile = false,
  latestVersion = '',
  selectedIds,
  onSelectionChange,
  onAdd,
  onEdit,
  onDelete,
  onProbe,
  onToggleEnable,
  onUpdateNode,
  onUpdateSelected,
}: NodeListProps) {
  const { t } = useTranslation();
  const relativeTime = useRelativeTime();

  const [showAddress, setShowAddress] = useState(false);
  const [statsNode, setStatsNode] = useState<NodeRow | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const dataSource = useMemo<NodeRow[]>(
    () => nodes.map((n) => ({
      ...n,
      url: `${n.scheme}://${n.address}:${n.port}${n.basePath || '/'}`,
      key: n.id,
    })),
    [nodes],
  );

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const columns = useMemo<ColumnDef<NodeRow, unknown>[]>(() => [
    {
      id: 'actions',
      size: 190,
      header: () => t('pages.nodes.actions'),
      cell: ({ row }) => {
        const record = row.original;
        return (
          <HStack>
            <Tooltip title={t('pages.nodes.probe')}>
              <Button variant="text" size="sm" icon={<ThunderboltOutlined />} onClick={() => onProbe(record)} />
            </Tooltip>
            {isUpdateEligible(record) && (
              <Tooltip title={t('pages.nodes.updatePanel')}>
                <Button variant="text" size="sm" icon={<CloudDownloadOutlined />} onClick={() => onUpdateNode(record)} />
              </Tooltip>
            )}
            <Tooltip title={t('edit')}>
              <Button variant="text" size="sm" icon={<EditOutlined />} onClick={() => onEdit(record)} />
            </Tooltip>
            <Tooltip title={t('delete')}>
              <Button variant="text" size="sm" danger icon={<DeleteOutlined />} onClick={() => onDelete(record)} />
            </Tooltip>
          </HStack>
        );
      },
    },
    {
      id: 'enable',
      size: 80,
      header: () => t('pages.nodes.enable'),
      cell: ({ row }) => (
        <Switch checked={!!row.original.enable} onChange={(v) => onToggleEnable(row.original, v)} />
      ),
    },
    {
      id: 'name',
      header: () => t('pages.nodes.name'),
      cell: ({ row }) => (
        <div className="name-cell">
          <span className="name">{row.original.name}</span>
          {row.original.remark && <span className="remark">{row.original.remark}</span>}
        </div>
      ),
    },
    {
      id: 'url',
      header: () => (
        <span className="address-header">
          {t('pages.nodes.address')}
          <Tooltip title={t('pages.index.toggleIpVisibility')}>
            {showAddress ? (
              <EyeOutlined className="ip-toggle-icon" onClick={() => setShowAddress(false)} />
            ) : (
              <EyeInvisibleOutlined className="ip-toggle-icon" onClick={() => setShowAddress(true)} />
            )}
          </Tooltip>
        </span>
      ),
      cell: ({ row }) => (
        <a
          href={row.original.url}
          target="_blank"
          rel="noopener noreferrer"
          className={showAddress ? 'address-visible' : 'address-hidden'}
        >
          {row.original.url}
        </a>
      ),
    },
    {
      id: 'status',
      header: () => t('pages.nodes.status'),
      cell: ({ row }) => {
        const record = row.original;
        return (
          <HStack gap={4}>
            <StatusDot status={record.status} />
            <StatusLabel status={record.status} />
            {record.lastError && (
              <Tooltip title={record.lastError}>
                <ExclamationCircleOutlined style={{ color: 'var(--color-warning)' }} />
              </Tooltip>
            )}
          </HStack>
        );
      },
    },
    { id: 'cpu', size: 90, header: () => t('pages.nodes.cpu'), cell: ({ row }) => formatPct(row.original.cpuPct) },
    { id: 'mem', size: 90, header: () => t('pages.nodes.mem'), cell: ({ row }) => formatPct(row.original.memPct) },
    { id: 'xrayVersion', header: () => t('pages.nodes.xrayVersion'), cell: ({ row }) => row.original.xrayVersion || '-' },
    {
      id: 'panelVersion',
      header: () => t('pages.nodes.panelVersion') || 'Panel version',
      cell: ({ row }) => {
        const record = row.original;
        const canUpdate = isUpdateEligible(record)
          && isPanelUpdateAvailable(latestVersion, record.panelVersion || '');
        return (
          <HStack gap={4}>
            <span>{record.panelVersion || '-'}</span>
            {canUpdate && (
              <Tooltip title={`${t('pages.nodes.updateAvailable')}: ${latestVersion}`}>
                <Tag tone="warning" style={{ cursor: 'pointer' }} onClick={() => onUpdateNode(record)}>
                  {t('pages.nodes.updateAvailable')}
                </Tag>
              </Tooltip>
            )}
          </HStack>
        );
      },
    },
    { id: 'uptime', header: () => t('pages.nodes.uptime'), cell: ({ row }) => formatUptime(row.original.uptimeSecs) },
    {
      id: 'clients',
      size: 160,
      header: () => t('clients'),
      cell: ({ row }) => {
        const record = row.original;
        return (
          <HStack gap={4}>
            <Tag tone="success">{record.clientCount || 0}</Tag>
            {record.onlineCount ? <Tag tone="primary">{record.onlineCount} {t('online')}</Tag> : null}
            {record.depletedCount ? <Tag tone="danger">{record.depletedCount} {t('depleted')}</Tag> : null}
          </HStack>
        );
      },
    },
    {
      id: 'latency',
      size: 100,
      header: () => t('pages.nodes.latency'),
      cell: ({ row }) => (row.original.latencyMs && row.original.latencyMs > 0 ? `${row.original.latencyMs} ms` : '-'),
    },
    {
      id: 'lastHeartbeat',
      size: 120,
      header: () => t('pages.nodes.lastHeartbeat'),
      cell: ({ row }) => relativeTime(row.original.lastHeartbeat),
    },
  ], [t, showAddress, relativeTime, latestVersion, onToggleEnable, onProbe, onEdit, onDelete, onUpdateNode]);

  function mobileMenu(record: NodeRow): MenuEntry[] {
    return [
      { key: 'probe', icon: <ThunderboltOutlined />, label: t('pages.nodes.probe'), onSelect: () => onProbe(record) },
      ...(isUpdateEligible(record)
        ? [{ key: 'update', icon: <CloudDownloadOutlined />, label: t('pages.nodes.updatePanel'), onSelect: () => onUpdateNode(record) } as MenuEntry]
        : []),
      { key: 'edit', icon: <EditOutlined />, label: t('edit'), onSelect: () => onEdit(record) },
      { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onSelect: () => onDelete(record) },
    ];
  }

  return (
    <TooltipProvider>
      <Card flush>
        <div className="toolbar" style={{ padding: 12 }}>
          <Button variant="primary" icon={<PlusOutlined />} onClick={onAdd}>
            {t('pages.nodes.addNode')}
          </Button>
          {selectedIds.length > 0 && (
            <Button icon={<CloudDownloadOutlined />} onClick={onUpdateSelected}>
              {t('pages.nodes.updateSelected', { count: selectedIds.length })}
            </Button>
          )}
        </div>

        {isMobile ? (
          <>
            <div className="node-cards">
              {dataSource.length === 0 ? (
                <div className="card-empty">
                  <ClusterOutlined style={{ fontSize: 28, opacity: 0.5 }} />
                  <div>{t('noData')}</div>
                </div>
              ) : (
                dataSource.map((record) => (
                  <div key={record.id} className="node-card">
                    <div className="card-head" onClick={() => toggleExpanded(record.id)}>
                      <RightOutlined className={`card-expand${expandedIds.has(record.id) ? ' is-expanded' : ''}`} />
                      <StatusDot status={record.status} />
                      <span className="node-name">{record.name}</span>
                      <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title={t('info')}>
                          <InfoCircleOutlined className="row-action-trigger" onClick={() => setStatsNode(record)} />
                        </Tooltip>
                        <Switch checked={!!record.enable} onChange={(v) => onToggleEnable(record, v)} />
                        <DropdownMenu
                          items={mobileMenu(record)}
                          trigger={<MoreOutlined className="row-action-trigger" />}
                        />
                      </div>
                    </div>

                    {expandedIds.has(record.id) && (
                      <div className="card-history">
                        <NodeHistoryPanel node={record} />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <Dialog
              open={!!statsNode}
              onOpenChange={(o) => !o && setStatsNode(null)}
              width={360}
              title={statsNode?.name || ''}
            >
              {statsNode && (
                <div className="card-stats">
                  {statsNode.remark && (
                    <div className="stat-row">
                      <span className="stat-label">{t('pages.nodes.name')}</span>
                      <span>{statsNode.remark}</span>
                    </div>
                  )}
                  <div className="stat-row">
                    <span className="stat-label">{t('pages.nodes.address')}</span>
                    <a
                      href={statsNode.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={showAddress ? 'address-visible' : 'address-hidden'}
                    >
                      {statsNode.url}
                    </a>
                    <Tooltip title={t('pages.index.toggleIpVisibility')}>
                      {showAddress ? (
                        <EyeOutlined className="ip-toggle-icon" onClick={() => setShowAddress(false)} />
                      ) : (
                        <EyeInvisibleOutlined className="ip-toggle-icon" onClick={() => setShowAddress(true)} />
                      )}
                    </Tooltip>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">{t('pages.nodes.status')}</span>
                    <StatusDot status={statsNode.status} />
                    <StatusLabel status={statsNode.status} />
                    {statsNode.lastError && (
                      <Tooltip title={statsNode.lastError}>
                        <ExclamationCircleOutlined style={{ color: 'var(--color-warning)' }} />
                      </Tooltip>
                    )}
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">{t('pages.nodes.cpu')}</span>
                    <Tag>{formatPct(statsNode.cpuPct)}</Tag>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">{t('pages.nodes.mem')}</span>
                    <Tag>{formatPct(statsNode.memPct)}</Tag>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">{t('pages.nodes.xrayVersion')}</span>
                    <Tag>{statsNode.xrayVersion || '-'}</Tag>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">{t('pages.nodes.panelVersion') || 'Panel version'}</span>
                    <Tag>{statsNode.panelVersion || '-'}</Tag>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">{t('pages.nodes.uptime')}</span>
                    <Tag>{formatUptime(statsNode.uptimeSecs)}</Tag>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">{t('pages.nodes.latency')}</span>
                    <Tag>{statsNode.latencyMs && statsNode.latencyMs > 0 ? `${statsNode.latencyMs} ms` : '-'}</Tag>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">{t('clients')}</span>
                    <Tag tone="success">{statsNode.clientCount || 0}</Tag>
                    {statsNode.onlineCount ? <Tag tone="primary">{statsNode.onlineCount} {t('online')}</Tag> : null}
                    {statsNode.depletedCount ? <Tag tone="danger">{statsNode.depletedCount} {t('depleted')}</Tag> : null}
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">{t('pages.nodes.lastHeartbeat')}</span>
                    <Tag>{relativeTime(statsNode.lastHeartbeat)}</Tag>
                  </div>
                </div>
              )}
            </Dialog>
          </>
        ) : (
          <DataTable<NodeRow>
            data={dataSource}
            columns={columns}
            getRowId={(n) => String(n.id)}
            sortable={false}
            rowSelection={dataSource.length > 1 ? {
              selectedIds: selectedIds.map(String),
              onChange: (ids) => onSelectionChange(ids.map(Number)),
              isSelectable: (record) => isUpdateEligible(record),
            } : undefined}
            expandable={{ render: (record) => <NodeHistoryPanel node={record} /> }}
            empty={
              <>
                <ClusterOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                <div>{t('noData')}</div>
              </>
            }
          />
        )}
      </Card>
    </TooltipProvider>
  );
}
