import { useTranslation } from 'react-i18next';
import { Button, Divider, Field, Input, Switch } from '@/components/ds';
import { useFormCtl } from '@/lib/form/FormContext';
import { Wireguard } from '@/utils';

interface WireguardFieldsProps {
  wgPubKey: string;
  regenInboundWg: () => void;
  regenWgPeerKeypair: (name: number) => void;
}

interface Peer {
  privateKey?: string;
  publicKey?: string;
  preSharedKey?: string;
  allowedIPs?: string[];
  keepAlive?: number;
}

function nextWgPeerAllowedIP(peers: Peer[] | undefined): string {
  const fallback = '10.0.0.2/32';
  let maxInt = -1;
  let prefix = 32;
  for (const peer of peers ?? []) {
    for (const ip of peer?.allowedIPs ?? []) {
      const m = /^\s*(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?\s*$/.exec(String(ip));
      if (!m) continue;
      const octets = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
      if (octets.some((o) => o > 255)) continue;
      const asInt = octets[0] * 16777216 + octets[1] * 65536 + octets[2] * 256 + octets[3];
      if (asInt > maxInt) {
        maxInt = asInt;
        prefix = m[5] !== undefined ? Math.min(Number(m[5]), 32) : 32;
      }
    }
  }
  if (maxInt < 0) return fallback;
  const next = maxInt + 1;
  const a = Math.floor(next / 16777216) % 256;
  const b = Math.floor(next / 65536) % 256;
  const c = Math.floor(next / 256) % 256;
  const d = next % 256;
  return `${a}.${b}.${c}.${d}/${prefix}`;
}

export default function WireguardFields({ wgPubKey, regenInboundWg, regenWgPeerKeypair }: WireguardFieldsProps) {
  const { t } = useTranslation();
  const ctl = useFormCtl();
  const peers = ctl.get<Peer[]>(['settings', 'peers']) ?? [];
  const setPeers = (next: Peer[]) => ctl.set(['settings', 'peers'], next);
  const patchPeer = (idx: number, p: Partial<Peer>) => setPeers(peers.map((r, i) => (i === idx ? { ...r, ...p } : r)));

  return (
    <>
      <Field label={t('pages.xray.wireguard.secretKey')}>
        <div className="ifm-inline">
          <Input value={ctl.get(['settings', 'secretKey']) ?? ''} onChange={(e) => ctl.set(['settings', 'secretKey'], e.target.value)} />
          <Button variant="default" onClick={regenInboundWg}>↻</Button>
        </div>
      </Field>
      <Field label={t('pages.xray.wireguard.publicKey')}>
        <Input value={wgPubKey} disabled />
      </Field>
      <Field label="MTU">
        <Input type="number" value={ctl.get(['settings', 'mtu']) ?? ''} onChange={(e) => ctl.set(['settings', 'mtu'], Number(e.target.value) || 0)} />
      </Field>
      <Field label={t('pages.inbounds.info.noKernelTun')}>
        <Switch checked={!!ctl.get(['settings', 'noKernelTun'])} onChange={(v) => ctl.set(['settings', 'noKernelTun'], v)} />
      </Field>

      <Field label={t('pages.inbounds.form.peers')}>
        <Button
          size="sm"
          variant="default"
          onClick={() => {
            const kp = Wireguard.generateKeypair();
            setPeers([
              ...peers,
              { privateKey: kp.privateKey, publicKey: kp.publicKey, allowedIPs: [nextWgPeerAllowedIP(peers)], keepAlive: 0 },
            ]);
          }}
          style={{ alignSelf: 'flex-start' }}
        >
          + {t('pages.inbounds.form.addPeer')}
        </Button>
      </Field>

      {peers.map((peer, idx) => {
        const ips = peer.allowedIPs ?? [];
        const setIps = (next: string[]) => patchPeer(idx, { allowedIPs: next });
        return (
          <div key={idx} className="wg-peer">
            <Divider>
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                {t('pages.inbounds.info.peerNumber', { n: idx + 1 })}
                {peers.length > 1 && (
                  <Button size="sm" variant="text" danger onClick={() => setPeers(peers.filter((_, i) => i !== idx))}>−</Button>
                )}
              </span>
            </Divider>
            <Field label={t('pages.xray.wireguard.secretKey')}>
              <div className="ifm-inline">
                <Input value={peer.privateKey ?? ''} onChange={(e) => patchPeer(idx, { privateKey: e.target.value })} />
                <Button variant="default" onClick={() => regenWgPeerKeypair(idx)}>↻</Button>
              </div>
            </Field>
            <Field label={t('pages.xray.wireguard.publicKey')}>
              <Input value={peer.publicKey ?? ''} onChange={(e) => patchPeer(idx, { publicKey: e.target.value })} />
            </Field>
            <Field label="PSK">
              <Input value={peer.preSharedKey ?? ''} onChange={(e) => patchPeer(idx, { preSharedKey: e.target.value })} />
            </Field>
            <Field label={t('pages.xray.wireguard.allowedIPs')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ips.map((ip, j) => (
                  <div key={j} style={{ display: 'flex', gap: 6 }}>
                    <Input value={ip ?? ''} onChange={(e) => setIps(ips.map((x, i) => (i === j ? e.target.value : x)))} />
                    {ips.length > 1 && <Button size="sm" variant="default" onClick={() => setIps(ips.filter((_, i) => i !== j))}>−</Button>}
                  </div>
                ))}
                <Button size="sm" variant="default" onClick={() => setIps([...ips, ''])} style={{ alignSelf: 'flex-start' }}>+</Button>
              </div>
            </Field>
            <Field label={t('pages.inbounds.form.keepAlive')}>
              <Input type="number" min={0} value={peer.keepAlive ?? ''} onChange={(e) => patchPeer(idx, { keepAlive: Number(e.target.value) || 0 })} />
            </Field>
          </div>
        );
      })}
    </>
  );
}
