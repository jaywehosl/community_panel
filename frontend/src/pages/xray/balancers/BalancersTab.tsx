import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, DataTable, Dialog, Divider, DropdownMenu, Segmented, Tag, type ColumnDef, type MenuEntry } from '@/components/ds';
import { PlusOutlined, MoreOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

import BalancerFormModal from './BalancerFormModal';
import type { BalancerFormValue } from './BalancerFormModal';
import { JsonEditor } from '@/components/form';
import type { XraySettingsValue, SetTemplate } from '@/hooks/useXraySetting';
import type {
  BalancerObject,
  BalancerStrategySettings,
  BalancerStrategyType,
} from '@/schemas/routing';

interface BalancersTabProps {
  templateSettings: XraySettingsValue | null;
  setTemplateSettings: SetTemplate;
  clientReverseTags: string[];
  isMobile: boolean;
}

type BalancerRecord = BalancerObject;

interface BalancerRow {
  key: number;
  tag: string;
  strategy: BalancerStrategyType;
  selector: string[];
  fallbackTag: string;
  settings?: BalancerStrategySettings;
}

const STRATEGY_LABELS: Record<string, string> = {
  random: 'Random',
  roundRobin: 'Round robin',
  leastLoad: 'Least load',
  leastPing: 'Least ping',
};

const DEFAULT_OBSERVATORY = Object.freeze({
  subjectSelector: [] as string[],
  probeURL: 'https://www.google.com/generate_204',
  probeInterval: '1m',
  enableConcurrency: true,
});

const DEFAULT_BURST_OBSERVATORY = Object.freeze({
  subjectSelector: [] as string[],
  pingConfig: {
    destination: 'https://www.google.com/generate_204',
    interval: '1m',
    connectivity: 'http://connectivitycheck.platform.hicloud.com/generate_204',
    timeout: '5s',
    sampling: 2,
  },
});

function collectSelectors(list: BalancerRecord[]): string[] {
  const out = new Set<string>();
  list.forEach((b) => (b.selector || []).forEach((s) => s && out.add(s)));
  return [...out];
}

function syncObservatories(t: XraySettingsValue) {
  const balancers = (t.routing?.balancers || []) as BalancerRecord[];

  const leastPings = balancers.filter((b) => b.strategy?.type === 'leastPing');
  if (leastPings.length > 0) {
    if (!t.observatory) t.observatory = JSON.parse(JSON.stringify(DEFAULT_OBSERVATORY));
    (t.observatory as { subjectSelector: string[] }).subjectSelector = collectSelectors(leastPings);
  } else {
    delete t.observatory;
  }

  const burstFeeders = balancers.filter((b) => {
    const type = b.strategy?.type || 'random';
    return type === 'leastLoad' || type === 'random' || type === 'roundRobin';
  });
  if (burstFeeders.length > 0) {
    if (!t.burstObservatory) t.burstObservatory = JSON.parse(JSON.stringify(DEFAULT_BURST_OBSERVATORY));
    (t.burstObservatory as { subjectSelector: string[] }).subjectSelector = collectSelectors(burstFeeders);
  } else {
    delete t.burstObservatory;
  }
}

export default function BalancersTab({
  templateSettings,
  setTemplateSettings,
  clientReverseTags,
  isMobile,
}: BalancersTabProps) {
  const { t } = useTranslation();
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBalancer, setEditingBalancer] = useState<BalancerFormValue | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const rows: BalancerRow[] = useMemo(() => {
    const list = (templateSettings?.routing?.balancers || []) as BalancerRecord[];
    return list.map((b, idx) => ({
      key: idx,
      tag: b.tag || '',
      strategy: (b.strategy?.type ?? 'random') as BalancerStrategyType,
      selector: b.selector || [],
      fallbackTag: b.fallbackTag || '',
      settings: b.strategy?.settings,
    }));
  }, [templateSettings?.routing?.balancers]);

  const outboundTags = useMemo(() => {
    const tags = new Set<string>();
    for (const o of templateSettings?.outbounds || []) {
      if (o?.tag) tags.add(o.tag);
    }
    for (const tag of clientReverseTags || []) {
      if (tag) tags.add(tag);
    }
    return [...tags];
  }, [templateSettings?.outbounds, clientReverseTags]);

  const otherTags = useMemo(() => {
    if (editingIndex == null) return rows.map((b) => b.tag).filter(Boolean);
    return rows.filter((b) => b.key !== editingIndex).map((b) => b.tag).filter(Boolean);
  }, [rows, editingIndex]);

  const mutate = useCallback(
    (mutator: (next: XraySettingsValue) => void) => {
      setTemplateSettings((prev) => {
        if (!prev) return prev;
        const clone = JSON.parse(JSON.stringify(prev)) as XraySettingsValue;
        mutator(clone);
        return clone;
      });
    },
    [setTemplateSettings],
  );

  function openAdd() {
    setEditingBalancer(null);
    setEditingIndex(null);
    setModalOpen(true);
  }
  function openEdit(idx: number) {
    setEditingBalancer(rows[idx]);
    setEditingIndex(idx);
    setModalOpen(true);
  }

  function onConfirm(form: BalancerFormValue) {
    mutate((tt) => {
      if (!tt.routing) tt.routing = { rules: [], balancers: [] };
      if (!Array.isArray(tt.routing.balancers)) tt.routing.balancers = [];
      const list = tt.routing.balancers as BalancerRecord[];
      const wire: BalancerRecord = {
        tag: form.tag,
        selector: [...form.selector],
        fallbackTag: form.fallbackTag || '',
      };
      if (form.strategy && form.strategy !== 'random') {
        wire.strategy = { type: form.strategy };
        if (form.strategy === 'leastLoad' && form.settings) {
          wire.strategy.settings = form.settings;
        }
      }
      if (editingIndex == null) {
        list.push(wire);
      } else {
        const oldTag = list[editingIndex]?.tag;
        list[editingIndex] = wire;
        if (oldTag && oldTag !== wire.tag) {
          const rules = tt.routing.rules || [];
          for (const rule of rules) {
            if (rule?.balancerTag === oldTag) rule.balancerTag = wire.tag;
          }
        }
      }
      syncObservatories(tt);
    });
    setModalOpen(false);
  }

  function confirmDelete(idx: number) {
    setDeleteIndex(idx);
  }
  function runDelete() {
    if (deleteIndex == null) return;
    const idx = deleteIndex;
    mutate((tt) => {
      if (tt.routing?.balancers) {
        tt.routing.balancers.splice(idx, 1);
        syncObservatories(tt);
      }
    });
    setDeleteIndex(null);
  }

  const columns: ColumnDef<BalancerRow, unknown>[] = [
    {
      id: 'action',
      size: 100,
      header: () => '#',
      cell: ({ row }) => {
        const index = row.index;
        const menu: MenuEntry[] = [
          ...(isMobile
            ? [{ key: 'edit', icon: <EditOutlined />, label: t('edit'), onSelect: () => openEdit(index) } as MenuEntry]
            : []),
          { key: 'del', icon: <DeleteOutlined />, label: t('delete'), danger: true, onSelect: () => confirmDelete(index) },
        ];
        return (
          <div className="action-cell">
            <span className="row-index">{index + 1}</span>
            <div className={!isMobile ? 'action-buttons' : ''}>
              {!isMobile && (
                <Button variant="text" size="sm" icon={<EditOutlined />} onClick={() => openEdit(index)} />
              )}
              <DropdownMenu items={menu} trigger={<Button variant="text" size="sm" icon={<MoreOutlined />} />} />
            </div>
          </div>
        );
      },
    },
    { id: 'tag', size: 160, header: () => 'Tag', cell: ({ row }) => row.original.tag },
    {
      id: 'strategy',
      size: 140,
      header: () => 'Strategy',
      cell: ({ row }) => (
        <Tag tone={row.original.strategy === 'random' ? 'primary' : 'success'}>
          {STRATEGY_LABELS[row.original.strategy] || row.original.strategy}
        </Tag>
      ),
    },
    {
      id: 'selector',
      header: () => 'Selector',
      cell: ({ row }) => (row.original.selector || []).map((sel) => (
        <Tag key={sel} className="info-large-tag">{sel}</Tag>
      )),
    },
    { id: 'fallbackTag', size: 160, header: () => 'Fallback', cell: ({ row }) => row.original.fallbackTag },
  ];

  const hasObservatory = !!templateSettings?.observatory;
  const hasBurstObservatory = !!templateSettings?.burstObservatory;
  const showObsEditor = hasObservatory || hasBurstObservatory;

  const [obsView, setObsView] = useState<'observatory' | 'burstObservatory'>('observatory');

  useEffect(() => {
    if (obsView === 'observatory' && !hasObservatory && hasBurstObservatory) {
      setObsView('burstObservatory');
    } else if (obsView === 'burstObservatory' && !hasBurstObservatory && hasObservatory) {
      setObsView('observatory');
    }
  }, [obsView, hasObservatory, hasBurstObservatory]);

  const obsText = useMemo(() => {
    const src = obsView === 'observatory' ? templateSettings?.observatory : templateSettings?.burstObservatory;
    return src ? JSON.stringify(src, null, 2) : '';
  }, [obsView, templateSettings?.observatory, templateSettings?.burstObservatory]);

  function onObsTextChange(next: string) {
    let parsed;
    try {
      parsed = JSON.parse(next);
    } catch {
      return;
    }
    mutate((tt) => {
      if (obsView === 'observatory') tt.observatory = parsed;
      else tt.burstObservatory = parsed;
    });
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
        {rows.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '28px 0' }}>
            <div style={{ color: 'var(--text-3)' }}>{t('emptyBalancersDesc')}</div>
            <Button variant="primary" icon={<PlusOutlined />} onClick={openAdd}>
              {t('pages.xray.Balancers')}
            </Button>
          </div>
        ) : (
          <>
            <Button variant="primary" icon={<PlusOutlined />} onClick={openAdd} style={{ alignSelf: 'flex-start' }}>
              {t('pages.xray.Balancers')}
            </Button>

            <DataTable<BalancerRow>
              data={rows}
              columns={columns}
              getRowId={(r) => String(r.key)}
              sortable={false}
            />

            {showObsEditor && (
              <>
                <Divider />
                <Segmented
                  value={obsView}
                  onChange={(v) => setObsView(v as 'observatory' | 'burstObservatory')}
                  options={[
                    ...(hasObservatory ? [{ value: 'observatory', label: 'Observatory' }] : []),
                    ...(hasBurstObservatory ? [{ value: 'burstObservatory', label: 'Burst Observatory' }] : []),
                  ]}
                />
                <JsonEditor
                  value={obsText}
                  onChange={onObsTextChange}
                  minHeight="220px"
                  maxHeight="480px"
                />
              </>
            )}
          </>
        )}
      </div>

      <Dialog
        open={deleteIndex != null}
        onOpenChange={(o) => { if (!o) setDeleteIndex(null); }}
        title={deleteIndex != null ? `${t('delete')} ${t('pages.xray.Balancers')} #${deleteIndex + 1}?` : ''}
        okText={t('delete')}
        cancelText={t('cancel')}
        okDanger
        onOk={runDelete}
        width={420}
      />

      <BalancerFormModal
        key={modalOpen ? `${editingIndex ?? 'new'}-${editingBalancer?.tag ?? ''}` : 'closed'}
        open={modalOpen}
        balancer={editingBalancer}
        outboundTags={outboundTags}
        otherTags={otherTags}
        onClose={() => setModalOpen(false)}
        onConfirm={onConfirm}
      />
    </>
  );
}
