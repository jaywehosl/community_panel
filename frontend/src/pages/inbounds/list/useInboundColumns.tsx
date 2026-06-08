import { useMemo, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { TeamOutlined } from '@ant-design/icons';

import { Popover, Switch, Tag, type ColumnDef, type TagTone } from '@/components/ds';
import { SizeFormatter, IntlUtil, ColorUtils } from '@/utils';
import { InfinityIcon } from '@/components/ui';
import { useDatepicker } from '@/hooks/useDatepicker';
import type { NodeRecord } from '@/api/queries/useNodesQuery';

import { RowActionsCell } from './RowActions';
import {
  readStreamHints,
  networkLabel,
  networkL4,
  shadowsocksNetworkLabel,
  tunnelNetworkLabel,
  mixedNetworkLabel,
} from './helpers';
import type { ClientCountEntry, DBInboundRecord, RowAction } from './types';

interface UseInboundColumnsParams {
  hasAnyRemark: boolean;
  hasActiveNode: boolean;
  nodesById: Map<number, NodeRecord>;
  clientCount: Record<number, ClientCountEntry>;
  subEnable: boolean;
  expireDiff: number;
  trafficDiff: number;
  onRowAction: (action: { key: RowAction; dbInbound: DBInboundRecord }) => void;
  onSwitchEnable: (dbInbound: DBInboundRecord, next: boolean) => void;
}

/** Map a usage/status color hint (antd-preset name) to the DS Tag tone. */
function usageTone(color: string): TagTone {
  switch (color) {
    case 'green': return 'success';
    case 'red': return 'danger';
    case 'orange': case 'gold': case 'yellow': return 'warning';
    case 'purple': case 'blue': case 'geekblue': case 'cyan': return 'primary';
    default: return 'neutral';
  }
}

export function useInboundColumns({
  hasAnyRemark,
  hasActiveNode,
  nodesById,
  clientCount,
  subEnable,
  expireDiff,
  trafficDiff,
  onRowAction,
  onSwitchEnable,
}: UseInboundColumnsParams): ColumnDef<DBInboundRecord, unknown>[] {
  const { t } = useTranslation();
  const { datepicker } = useDatepicker();

  return useMemo<ColumnDef<DBInboundRecord, unknown>[]>(() => {
    const emailList = (title: string, emails: string[], tone: TagTone) => (
      <Popover
        side="bottom"
        content={
          <div className="client-email-list">
            <div className="ds-popover-title">{title}</div>
            {emails.map((e) => <div key={e}>{e}</div>)}
          </div>
        }
        trigger={
          <Tag tone={tone} className="client-count-tag" style={{ margin: 0, padding: '0 2px', cursor: 'pointer' }}>{emails.length}</Tag>
        }
      />
    );

    const cols: ColumnDef<DBInboundRecord, unknown>[] = [
      { id: 'id', size: 30, header: () => 'ID', cell: ({ row }) => row.original.id },
      {
        id: 'action',
        size: 60,
        header: () => t('pages.inbounds.operate'),
        cell: ({ row }) => (
          <RowActionsCell
            record={row.original}
            subEnable={subEnable}
            hasClients={(clientCount[row.original.id]?.clients || 0) > 0}
            onClick={(key) => onRowAction({ key, dbInbound: row.original })}
          />
        ),
      },
      {
        id: 'enable',
        size: 35,
        header: () => t('pages.inbounds.enable'),
        cell: ({ row }) => (
          <Switch checked={row.original.enable} onChange={(next) => onSwitchEnable(row.original, next)} />
        ),
      },
    ];

    if (hasAnyRemark) {
      cols.push({ id: 'remark', size: 60, header: () => t('pages.inbounds.remark'), cell: ({ row }) => row.original.remark });
    }

    if (hasActiveNode) {
      cols.push({
        id: 'node',
        size: 60,
        header: () => t('pages.inbounds.node'),
        cell: ({ row }) => {
          const record = row.original;
          if (record.nodeId == null) return <Tag>{t('pages.inbounds.localPanel')}</Tag>;
          const node = nodesById.get(record.nodeId);
          if (!node) return <Tag tone="warning">node #{record.nodeId}</Tag>;
          return <Tag tone={node.status === 'online' ? 'primary' : 'danger'}>{node.name}</Tag>;
        },
      });
    }

    cols.push(
      { id: 'port', size: 40, header: () => t('pages.inbounds.port'), cell: ({ row }) => row.original.port },
      {
        id: 'protocol',
        size: 130,
        header: () => t('pages.inbounds.protocol'),
        cell: ({ row }) => {
          const record = row.original;
          const tags: ReactElement[] = [<Tag key="p" tone="primary">{record.protocol}</Tag>];
          if (record.isWireguard || record.isHysteria) {
            tags.push(<Tag key="n" tone="success">UDP</Tag>);
          } else if (record.isSS) {
            const stream = readStreamHints(record.streamSettings);
            tags.push(<Tag key="n" tone="success">{shadowsocksNetworkLabel(record.settings)}</Tag>);
            if (stream.isTls) tags.push(<Tag key="tls" tone="primary">TLS</Tag>);
          } else if (record.isTunnel) {
            tags.push(<Tag key="n" tone="success">{tunnelNetworkLabel(record.settings)}</Tag>);
          } else if (record.isMixed) {
            tags.push(<Tag key="n" tone="success">{mixedNetworkLabel(record.settings)}</Tag>);
          } else if (record.isVMess || record.isVLess || record.isTrojan) {
            const stream = readStreamHints(record.streamSettings);
            tags.push(<Tag key="n" tone="success">{networkLabel(stream.network)}</Tag>);
            const l4 = networkL4(stream.network);
            if (l4) tags.push(<Tag key="l4" tone="success">{l4}</Tag>);
            if (stream.isTls) tags.push(<Tag key="tls" tone="primary">TLS</Tag>);
            if (stream.isReality) tags.push(<Tag key="reality" tone="primary">Reality</Tag>);
          }
          return <div className="protocol-tags">{tags}</div>;
        },
      },
      {
        id: 'clients',
        size: 110,
        header: () => t('clients'),
        cell: ({ row }) => {
          const cc = clientCount[row.original.id];
          if (!cc) return null;
          return (
            <>
              <Tag className="client-count-tag" style={{ margin: 0, padding: '0 2px' }}>
                <TeamOutlined /> {cc.clients}
              </Tag>
              {cc.active.length > 0 && emailList(t('subscription.active'), cc.active, 'success')}
              {cc.deactive.length > 0 && emailList(t('disabled'), cc.deactive, 'neutral')}
              {cc.depleted.length > 0 && emailList(t('depleted'), cc.depleted, 'danger')}
              {cc.online.length > 0 && emailList(t('online'), cc.online, 'primary')}
            </>
          );
        },
      },
      {
        id: 'traffic',
        size: 90,
        header: () => t('pages.inbounds.traffic'),
        cell: ({ row }) => {
          const record = row.original;
          return (
            <Popover
              content={
                <table cellPadding={2}>
                  <tbody>
                    <tr>
                      <td>↑ {SizeFormatter.sizeFormat(record.up)}</td>
                      <td>↓ {SizeFormatter.sizeFormat(record.down)}</td>
                    </tr>
                    {record.total > 0 && record.up + record.down < record.total && (
                      <tr>
                        <td>{t('remained')}</td>
                        <td>{SizeFormatter.sizeFormat(record.total - record.up - record.down)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              }
              trigger={
                <Tag tone={usageTone(ColorUtils.usageColor(record.up + record.down, trafficDiff, record.total))} style={{ cursor: 'pointer' }}>
                  {SizeFormatter.sizeFormat(record.up + record.down)} /{' '}
                  {record.total > 0 ? SizeFormatter.sizeFormat(record.total) : <InfinityIcon />}
                </Tag>
              }
            />
          );
        },
      },
      {
        id: 'expiryTime',
        size: 40,
        header: () => t('pages.inbounds.expireDate'),
        cell: ({ row }) => {
          const record = row.original;
          if (record.expiryTime > 0) {
            return (
              <Popover
                content={IntlUtil.formatDate(record.expiryTime, datepicker)}
                trigger={
                  <Tag tone={usageTone(ColorUtils.usageColor(Date.now(), expireDiff, record._expiryTime))} style={{ minWidth: 50, cursor: 'pointer' }}>
                    {IntlUtil.formatRelativeTime(record.expiryTime)}
                  </Tag>
                }
              />
            );
          }
          return <Tag tone="primary"><InfinityIcon /></Tag>;
        },
      },
    );

    return cols;
  }, [t, hasAnyRemark, hasActiveNode, nodesById, clientCount, subEnable, expireDiff, trafficDiff, datepicker, onRowAction, onSwitchEnable]);
}
