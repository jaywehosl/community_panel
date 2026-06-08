import { useMemo } from 'react';
import { Form } from 'antd';
import type { FormInstance } from 'antd/es/form';
import type { NamePath } from 'antd/es/form/interface';

import { Button, Divider, Field, Input, Select, Switch } from '@/components/ds';
import { TagListEditor } from '@/components/form';
import { useFormCtl } from '@/lib/form/FormContext';
import type { FieldPath } from '@/lib/form/useFormState';
import type { FormController } from '@/lib/form/useFormState';
import { RandomUtil } from '@/utils';
import { OutboundProtocols } from '@/schemas/primitives';

export interface FinalMaskFormProps {
  name: FieldPath | string;
  network: string;
  protocol: string;
  // When true, all sections (TCP / UDP / QUIC) are shown regardless of
  // network/protocol. Used by the global sub-JSON finalmask editor.
  showAll?: boolean;
  // Legacy antd callers (OutboundFormModal, SubJsonFinalMaskForm) pass an
  // antd FormInstance; the inbound subsystem omits it and relies on the
  // controlled FormProvider context instead.
  form?: FormInstance;
}

const TCP_NETWORKS = ['raw', 'tcp', 'httpupgrade', 'ws', 'grpc', 'xhttp'];

function asPath(name: FieldPath | string): FieldPath {
  return Array.isArray(name) ? [...name] : [name];
}

function defaultTcpMaskSettings(type: string): Record<string, unknown> {
  switch (type) {
    case 'fragment':
      return { packets: '1-3', length: '', delay: '', maxSplit: '' };
    case 'sudoku':
      return { password: '', ascii: '', customTable: '', customTables: '', paddingMin: 0, paddingMax: 0 };
    case 'header-custom':
      return { clients: [], servers: [] };
    default:
      return {};
  }
}

function defaultUdpMaskSettings(type: string): Record<string, unknown> {
  switch (type) {
    case 'salamander':
      return { password: '' };
    case 'mkcp-legacy':
      return { header: '', value: '' };
    case 'xdns':
      return { domains: [] };
    case 'xicmp':
      return { dgram: false, ips: [] };
    case 'realm':
      return { url: '', stunServers: [] };
    case 'header-custom':
      return { client: [], server: [] };
    case 'noise':
      return { reset: 0, noise: [] };
    default:
      return {};
  }
}

const defaultClientServerItem = (): Record<string, unknown> => ({ delay: 0, rand: 0, randRange: '0-255', type: 'array', packet: [] });
const defaultUdpClientServerItem = (): Record<string, unknown> => ({ rand: 0, randRange: '0-255', type: 'array', packet: [] });
const defaultNoiseItem = (): Record<string, unknown> => ({ rand: '1-8192', randRange: '0-255', type: 'array', packet: [], delay: '10-20' });

function defaultQuicParams(): Record<string, unknown> {
  return {
    congestion: 'bbr',
    debug: false,
    maxIdleTimeout: 30,
    keepAlivePeriod: 10,
    disablePathMTUDiscovery: false,
    maxIncomingStreams: 1024,
    initStreamReceiveWindow: 8388608,
    maxStreamReceiveWindow: 8388608,
    initConnectionReceiveWindow: 20971520,
    maxConnectionReceiveWindow: 20971520,
  };
}

const defaultUdpHop = (): Record<string, unknown> => ({ ports: '20000-50000', interval: '5-10' });

// ---- small controlled helpers -----------------------------------------

type Ctl = FormController<Record<string, unknown>>;

function useArr<T = unknown>(ctl: Ctl, path: FieldPath): [T[], (next: T[]) => void] {
  const arr = (ctl.get<T[]>(path) ?? []) as T[];
  return [arr, (next: T[]) => ctl.set(path, next)];
}

function TextField({ ctl, path, label, placeholder }: { ctl: Ctl; path: FieldPath; label: string; placeholder?: string }) {
  return (
    <Field label={label}>
      <Input placeholder={placeholder} value={(ctl.get(path) as string) ?? ''} onChange={(e) => ctl.set(path, e.target.value)} />
    </Field>
  );
}

function NumField({ ctl, path, label, min, max, placeholder }: { ctl: Ctl; path: FieldPath; label: string; min?: number; max?: number; placeholder?: string }) {
  return (
    <Field label={label}>
      <Input type="number" min={min} max={max} placeholder={placeholder} value={(ctl.get(path) as number | undefined) ?? ''} onChange={(e) => ctl.set(path, Number(e.target.value) || 0)} />
    </Field>
  );
}

function SwitchField({ ctl, path, label }: { ctl: Ctl; path: FieldPath; label: string }) {
  return (
    <Field label={label}>
      <Switch checked={!!ctl.get(path)} onChange={(v) => ctl.set(path, v)} />
    </Field>
  );
}

function SectionHead({ title, onRemove }: { title: string; onRemove: () => void }) {
  return (
    <Divider>
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        {title}
        <Button size="sm" variant="text" danger onClick={onRemove}>×</Button>
      </span>
    </Divider>
  );
}

// ---- root --------------------------------------------------------------

export default function FinalMaskForm({ name, network, protocol, showAll = false, form }: FinalMaskFormProps) {
  // Stable branch: a given call site always passes `form` or never does, so
  // each child component's hook order stays consistent across renders.
  if (form) return <FinalMaskFormAntd name={name} network={network} protocol={protocol} showAll={showAll} form={form} />;
  return <FinalMaskFormCtx name={name} network={network} protocol={protocol} showAll={showAll} />;
}

function FinalMaskFormCtx({ name, network, protocol, showAll }: Omit<FinalMaskFormProps, 'form'>) {
  const ctl = useFormCtl() as unknown as Ctl;
  return <FinalMaskBody ctl={ctl} base={asPath(name)} network={network} protocol={protocol} showAll={!!showAll} />;
}

function FinalMaskFormAntd({ name, network, protocol, showAll, form }: FinalMaskFormProps & { form: FormInstance }) {
  const base = asPath(name);
  // Subscribe to the base subtree so antd-mode edits re-render the body.
  const watched = Form.useWatch(base as NamePath, { form, preserve: true });
  const ctl = useMemo<Ctl>(() => ({
    values: form.getFieldsValue(true),
    get: ((path: FieldPath) => form.getFieldValue(path as NamePath)) as Ctl['get'],
    set: (path: FieldPath, value: unknown) => form.setFieldValue(path as NamePath, value),
    unset: () => {},
    reset: () => {},
    setValues: () => {},
  }), [form, watched]);
  return <FinalMaskBody ctl={ctl} base={base} network={network} protocol={protocol} showAll={!!showAll} />;
}

function FinalMaskBody({ ctl, base, network, protocol, showAll }: { ctl: Ctl; base: FieldPath; network: string; protocol: string; showAll: boolean }) {
  const isHysteria = protocol === OutboundProtocols.Hysteria || protocol === 'hysteria';
  const showTcp = showAll || TCP_NETWORKS.includes(network);
  const showUdp = showAll || isHysteria || network === 'kcp';
  const showQuic = showAll || isHysteria || network === 'xhttp';

  const hasQuicParams = ctl.get([...base, 'quicParams']) != null;

  if (!showTcp && !showUdp && !showQuic) return null;

  return (
    <>
      {showTcp && <TcpMasksList ctl={ctl} base={base} />}
      {showUdp && <UdpMasksList ctl={ctl} base={base} isHysteria={isHysteria} network={network} />}
      {showQuic && (
        <>
          <Field label="QUIC Params">
            <Switch checked={hasQuicParams} onChange={(v) => ctl.set([...base, 'quicParams'], v ? defaultQuicParams() : undefined)} />
          </Field>
          {hasQuicParams && <QuicParamsForm ctl={ctl} base={[...base, 'quicParams']} />}
        </>
      )}
    </>
  );
}

function TcpMasksList({ ctl, base }: { ctl: Ctl; base: FieldPath }) {
  const path = [...base, 'tcp'];
  const [arr, setArr] = useArr<{ type?: string }>(ctl, path);
  return (
    <>
      <Field label="TCP Masks">
        <Button size="sm" variant="primary" onClick={() => setArr([...arr, { type: 'fragment', settings: defaultTcpMaskSettings('fragment') } as Record<string, unknown>])}>+</Button>
      </Field>
      {arr.map((_, idx) => (
        <TcpMaskItem key={idx} ctl={ctl} itemPath={[...path, idx]} displayIndex={idx + 1} onRemove={() => setArr(arr.filter((_, i) => i !== idx))} />
      ))}
    </>
  );
}

function TcpMaskItem({ ctl, itemPath, displayIndex, onRemove }: { ctl: Ctl; itemPath: FieldPath; displayIndex: number; onRemove: () => void }) {
  const type = ctl.get<string>([...itemPath, 'type']);
  const sp = [...itemPath, 'settings'];
  return (
    <div>
      <SectionHead title={`TCP Mask ${displayIndex}`} onRemove={onRemove} />
      <Field label="Type">
        <Select
          value={type ?? 'fragment'}
          onChange={(v) => { ctl.set([...itemPath, 'type'], v); ctl.set(sp, defaultTcpMaskSettings(v)); }}
          options={[
            { value: 'fragment', label: 'Fragment' },
            { value: 'header-custom', label: 'Header Custom' },
            { value: 'sudoku', label: 'Sudoku' },
          ]}
        />
      </Field>
      {type === 'fragment' && (
        <>
          <Field label="Packets">
            <Select value={(ctl.get([...sp, 'packets']) as string) ?? '1-3'} onChange={(v) => ctl.set([...sp, 'packets'], v)} options={[
              { value: 'tlshello', label: 'tlshello' },
              { value: '1-3', label: '1-3' },
              { value: '1-5', label: '1-5' },
            ]} />
          </Field>
          <TextField ctl={ctl} path={[...sp, 'length']} label="Length" />
          <TextField ctl={ctl} path={[...sp, 'delay']} label="Delay" />
          <TextField ctl={ctl} path={[...sp, 'maxSplit']} label="Max Split" />
        </>
      )}
      {type === 'sudoku' && (
        <>
          <TextField ctl={ctl} path={[...sp, 'password']} label="Password" />
          <TextField ctl={ctl} path={[...sp, 'ascii']} label="ASCII" />
          <TextField ctl={ctl} path={[...sp, 'customTable']} label="Custom Table" />
          <TextField ctl={ctl} path={[...sp, 'customTables']} label="Custom Tables" />
          <NumField ctl={ctl} path={[...sp, 'paddingMin']} label="Padding Min" min={0} />
          <NumField ctl={ctl} path={[...sp, 'paddingMax']} label="Padding Max" min={0} />
        </>
      )}
      {type === 'header-custom' && <HeaderCustomGroups ctl={ctl} settingsPath={sp} />}
    </div>
  );
}

function HeaderCustomGroups({ ctl, settingsPath }: { ctl: Ctl; settingsPath: FieldPath }) {
  return (
    <>
      {(['clients', 'servers'] as const).map((groupKey) => {
        const gPath = [...settingsPath, groupKey];
        const groups = (ctl.get<unknown[][]>(gPath) ?? []) as Record<string, unknown>[][];
        const setGroups = (next: Record<string, unknown>[][]) => ctl.set(gPath, next);
        return (
          <div key={groupKey}>
            <Field label={groupKey === 'clients' ? 'Clients' : 'Servers'}>
              <Button size="sm" variant="primary" onClick={() => setGroups([...groups, [defaultClientServerItem()]])}>+</Button>
            </Field>
            {groups.map((items, gi) => (
              <div key={gi}>
                <SectionHead title={`${groupKey === 'clients' ? 'Clients' : 'Servers'} Group ${gi + 1}`} onRemove={() => setGroups(groups.filter((_, i) => i !== gi))} />
                <Field label="Items">
                  <Button size="sm" variant="default" onClick={() => ctl.set([...gPath, gi], [...(items ?? []), defaultClientServerItem()])}>+</Button>
                </Field>
                {(items ?? []).map((_, ii) => (
                  <ItemEditor key={ii} ctl={ctl} itemPath={[...gPath, gi, ii]} delayMode="number" onRemove={() => ctl.set([...gPath, gi], items.filter((_, i) => i !== ii))} />
                ))}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

function UdpMasksList({ ctl, base, isHysteria, network }: { ctl: Ctl; base: FieldPath; isHysteria: boolean; network: string }) {
  const path = [...base, 'udp'];
  const [arr, setArr] = useArr<{ type?: string }>(ctl, path);
  return (
    <>
      <Field label="UDP Masks">
        <Button size="sm" variant="primary" onClick={() => {
          const def = isHysteria ? 'salamander' : 'mkcp-legacy';
          setArr([...arr, { type: def, settings: defaultUdpMaskSettings(def) } as Record<string, unknown>]);
        }}>+</Button>
      </Field>
      {arr.map((_, idx) => (
        <UdpMaskItem key={idx} ctl={ctl} listPath={path} itemPath={[...path, idx]} displayIndex={idx + 1} isHysteria={isHysteria} network={network} onRemove={() => setArr(arr.filter((_, i) => i !== idx))} />
      ))}
    </>
  );
}

function UdpMaskItem({ ctl, listPath, itemPath, displayIndex, isHysteria, network, onRemove }: { ctl: Ctl; listPath: FieldPath; itemPath: FieldPath; displayIndex: number; isHysteria: boolean; network: string; onRemove: () => void }) {
  const type = ctl.get<string>([...itemPath, 'type']);
  const sp = [...itemPath, 'settings'];

  const onTypeChange = (v: string) => {
    ctl.set([...itemPath, 'type'], v);
    ctl.set(sp, defaultUdpMaskSettings(v));
    if (network === 'kcp') {
      const kcpMtuPath = [...listPath.slice(0, -1), 'kcpSettings', 'mtu'];
      ctl.set(kcpMtuPath, v === 'xdns' ? 900 : 1350);
    }
  };

  const options = isHysteria
    ? [{ value: 'salamander', label: 'Salamander (Hysteria2)' }]
    : [
      { value: 'mkcp-legacy', label: 'mKCP Legacy' },
      { value: 'xdns', label: 'xDNS' },
      { value: 'xicmp', label: 'xICMP' },
      { value: 'realm', label: 'Realm' },
      { value: 'header-custom', label: 'Header Custom' },
      { value: 'noise', label: 'Noise' },
    ];

  return (
    <div>
      <SectionHead title={`UDP Mask ${displayIndex}`} onRemove={onRemove} />
      <Field label="Type">
        <Select value={type ?? (isHysteria ? 'salamander' : 'mkcp-legacy')} onChange={onTypeChange} options={options} />
      </Field>
      {type === 'salamander' && (
        <Field label="Password">
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Input placeholder="Obfuscation password" value={(ctl.get([...sp, 'password']) as string) ?? ''} onChange={(e) => ctl.set([...sp, 'password'], e.target.value)} />
            <Button variant="default" onClick={() => ctl.set([...sp, 'password'], RandomUtil.randomLowerAndNum(16))}>↻</Button>
          </div>
        </Field>
      )}
      {type === 'mkcp-legacy' && (
        <>
          <Field label="Header">
            <Select value={(ctl.get([...sp, 'header']) as string) ?? ''} onChange={(v) => ctl.set([...sp, 'header'], v)} options={[
              { value: '', label: 'Original / AES-128-GCM' },
              { value: 'dns', label: 'DNS' },
              { value: 'dtls', label: 'DTLS 1.2' },
              { value: 'srtp', label: 'SRTP' },
              { value: 'utp', label: 'uTP' },
              { value: 'wechat', label: 'WeChat Video' },
              { value: 'wireguard', label: 'WireGuard' },
            ]} />
          </Field>
          <TextField ctl={ctl} path={[...sp, 'value']} label="Value" placeholder="password (AES-128-GCM) or domain (DNS header)" />
        </>
      )}
      {type === 'xdns' && (
        <Field label="Domains">
          <TagListEditor value={ctl.get<string[]>([...sp, 'domains'])} onChange={(v) => ctl.set([...sp, 'domains'], v)} separators={[',']} />
        </Field>
      )}
      {type === 'xicmp' && (
        <>
          <SwitchField ctl={ctl} path={[...sp, 'dgram']} label="Dgram" />
          <Field label="IPs">
            <TagListEditor value={ctl.get<string[]>([...sp, 'ips'])} onChange={(v) => ctl.set([...sp, 'ips'], v)} separators={[',']} />
          </Field>
        </>
      )}
      {type === 'realm' && (
        <>
          <TextField ctl={ctl} path={[...sp, 'url']} label="URL" placeholder="realm://token@host:port/id" />
          <Field label="STUN Servers">
            <TagListEditor value={ctl.get<string[]>([...sp, 'stunServers'])} onChange={(v) => ctl.set([...sp, 'stunServers'], v)} placeholder="host:port" separators={[',']} />
          </Field>
        </>
      )}
      {type === 'header-custom' && <UdpHeaderCustom ctl={ctl} settingsPath={sp} />}
      {type === 'noise' && <NoiseItems ctl={ctl} settingsPath={sp} />}
    </div>
  );
}

function UdpHeaderCustom({ ctl, settingsPath }: { ctl: Ctl; settingsPath: FieldPath }) {
  return (
    <>
      {(['client', 'server'] as const).map((groupKey) => {
        const gPath = [...settingsPath, groupKey];
        const items = (ctl.get<unknown[]>(gPath) ?? []) as Record<string, unknown>[];
        const setItems = (next: Record<string, unknown>[]) => ctl.set(gPath, next);
        return (
          <div key={groupKey}>
            <Field label={groupKey === 'client' ? 'Client' : 'Server'}>
              <Button size="sm" variant="primary" onClick={() => setItems([...items, defaultUdpClientServerItem()])}>+</Button>
            </Field>
            {items.map((_, ci) => (
              <div key={ci}>
                <SectionHead title={`${groupKey === 'client' ? 'Client' : 'Server'} ${ci + 1}`} onRemove={() => setItems(items.filter((_, i) => i !== ci))} />
                <ItemEditor ctl={ctl} itemPath={[...gPath, ci]} onRemove={() => setItems(items.filter((_, i) => i !== ci))} />
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

function NoiseItems({ ctl, settingsPath }: { ctl: Ctl; settingsPath: FieldPath }) {
  const nPath = [...settingsPath, 'noise'];
  const items = (ctl.get<unknown[]>(nPath) ?? []) as Record<string, unknown>[];
  const setItems = (next: Record<string, unknown>[]) => ctl.set(nPath, next);
  return (
    <>
      <NumField ctl={ctl} path={[...settingsPath, 'reset']} label="Reset" min={0} />
      <Field label="Noise">
        <Button size="sm" variant="primary" onClick={() => setItems([...items, defaultNoiseItem()])}>+</Button>
      </Field>
      {items.map((_, ni) => (
        <div key={ni}>
          <SectionHead title={`Noise ${ni + 1}`} onRemove={() => setItems(items.filter((_, i) => i !== ni))} />
          <ItemEditor ctl={ctl} itemPath={[...nPath, ni]} delayMode="string" onRemove={() => setItems(items.filter((_, i) => i !== ni))} />
        </div>
      ))}
    </>
  );
}

function ItemEditor({ ctl, itemPath, delayMode }: { ctl: Ctl; itemPath: FieldPath; delayMode?: 'number' | 'string'; onRemove?: () => void }) {
  const type = ctl.get<string>([...itemPath, 'type']);
  const onTypeChange = (v: string) => {
    ctl.set([...itemPath, 'type'], v);
    if (v === 'base64') {
      ctl.set([...itemPath, 'packet'], RandomUtil.randomBase64());
    } else if (v === 'array') {
      ctl.set([...itemPath, 'rand'], delayMode === 'string' ? '1-8192' : 0);
      ctl.set([...itemPath, 'packet'], []);
    } else {
      ctl.set([...itemPath, 'packet'], '');
    }
  };
  return (
    <>
      <Field label="Type">
        <Select value={type ?? 'array'} onChange={onTypeChange} options={[
          { value: 'array', label: 'Array' },
          { value: 'str', label: 'String' },
          { value: 'hex', label: 'Hex' },
          { value: 'base64', label: 'Base64' },
        ]} />
      </Field>
      {delayMode === 'number' && <NumField ctl={ctl} path={[...itemPath, 'delay']} label="Delay (ms)" min={0} />}
      {delayMode === 'string' && <TextField ctl={ctl} path={[...itemPath, 'delay']} label="Delay" placeholder="10-20" />}

      {type === 'array' && (
        <>
          {delayMode === 'string'
            ? <TextField ctl={ctl} path={[...itemPath, 'rand']} label="Rand" placeholder="0 or 1-8192" />
            : <NumField ctl={ctl} path={[...itemPath, 'rand']} label="Rand" min={0} />}
          <TextField ctl={ctl} path={[...itemPath, 'randRange']} label="Rand Range" placeholder="0-255" />
        </>
      )}
      {type === 'base64' && (
        <Field label="Packet">
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Input placeholder="binary data" value={(ctl.get([...itemPath, 'packet']) as string) ?? ''} onChange={(e) => ctl.set([...itemPath, 'packet'], e.target.value)} />
            <Button variant="default" onClick={() => ctl.set([...itemPath, 'packet'], RandomUtil.randomBase64())}>↻</Button>
          </div>
        </Field>
      )}
      {type !== 'array' && type !== 'base64' && (
        <TextField ctl={ctl} path={[...itemPath, 'packet']} label="Packet" placeholder="binary data" />
      )}
    </>
  );
}

function QuicParamsForm({ ctl, base }: { ctl: Ctl; base: FieldPath }) {
  const congestion = ctl.get<string>([...base, 'congestion']);
  const hasUdpHop = ctl.get([...base, 'udpHop']) != null;
  return (
    <>
      <Field label="Congestion">
        <Select value={congestion ?? 'bbr'} onChange={(v) => ctl.set([...base, 'congestion'], v)} options={[
          { value: 'reno', label: 'Reno' },
          { value: 'bbr', label: 'BBR' },
          { value: 'brutal', label: 'Brutal' },
          { value: 'force-brutal', label: 'Force Brutal' },
        ]} />
      </Field>
      {congestion === 'bbr' && (
        <Field label="BBR Profile">
          <Select value={(ctl.get([...base, 'bbrProfile']) as string) ?? ''} onChange={(v) => ctl.set([...base, 'bbrProfile'], v)} options={[
            { value: '', label: 'standard' },
            { value: 'conservative', label: 'Conservative' },
            { value: 'standard', label: 'Standard' },
            { value: 'aggressive', label: 'Aggressive' },
          ]} />
        </Field>
      )}
      <SwitchField ctl={ctl} path={[...base, 'debug']} label="Debug" />
      {(congestion === 'brutal' || congestion === 'force-brutal') && (
        <>
          <TextField ctl={ctl} path={[...base, 'brutalUp']} label="Brutal Up" placeholder="e.g. 60 mbps" />
          <TextField ctl={ctl} path={[...base, 'brutalDown']} label="Brutal Down" placeholder="e.g. 100 mbps" />
        </>
      )}
      <Field label="UDP Hop">
        <Switch checked={hasUdpHop} onChange={(v) => ctl.set([...base, 'udpHop'], v ? defaultUdpHop() : undefined)} />
      </Field>
      {hasUdpHop && (
        <>
          <TextField ctl={ctl} path={[...base, 'udpHop', 'ports']} label="Hop Ports" placeholder="e.g. 20000-50000" />
          <TextField ctl={ctl} path={[...base, 'udpHop', 'interval']} label="Hop Interval (s)" placeholder="e.g. 5-10" />
        </>
      )}
      <NumField ctl={ctl} path={[...base, 'maxIdleTimeout']} label="Max Idle Timeout (s)" min={4} max={120} />
      <NumField ctl={ctl} path={[...base, 'keepAlivePeriod']} label="Keep Alive Period (s)" min={2} max={60} />
      <SwitchField ctl={ctl} path={[...base, 'disablePathMTUDiscovery']} label="Disable Path MTU Dis" />
      <NumField ctl={ctl} path={[...base, 'maxIncomingStreams']} label="Max Incoming Streams" min={8} placeholder="1024 = default" />
      <NumField ctl={ctl} path={[...base, 'initStreamReceiveWindow']} label="Init Stream Window" min={16384} placeholder="8388608 = default" />
      <NumField ctl={ctl} path={[...base, 'maxStreamReceiveWindow']} label="Max Stream Window" min={16384} placeholder="8388608 = default" />
      <NumField ctl={ctl} path={[...base, 'initConnectionReceiveWindow']} label="Init Conn Window" min={16384} placeholder="20971520 = default" />
      <NumField ctl={ctl} path={[...base, 'maxConnectionReceiveWindow']} label="Max Conn Window" min={16384} placeholder="20971520 = default" />
    </>
  );
}
