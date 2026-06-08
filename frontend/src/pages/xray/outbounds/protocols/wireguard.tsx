import { useTranslation } from 'react-i18next';
import { Button, Field, Input, Select, Switch } from '@/components/ds';
import { useFormCtl } from '@/lib/form/FormContext';

import { Wireguard } from '@/utils';
import { WireguardDomainStrategy } from '@/schemas/primitives';

interface Peer { publicKey?: string; psk?: string; allowedIPs?: string[]; endpoint?: string; keepAlive?: number }

export default function WireguardFields() {
  const { t } = useTranslation();
  const ctl = useFormCtl();

  const peers = ctl.get<Peer[]>(['settings', 'peers']) ?? [];
  const setPeers = (next: Peer[]) => ctl.set(['settings', 'peers'], next);
  const patchPeer = (idx: number, p: Partial<Peer>) => setPeers(peers.map((peer, i) => (i === idx ? { ...peer, ...p } : peer)));

  return (
    <>
      <Field label={t('pages.inbounds.address')}>
        <Input placeholder="comma-separated, e.g. 10.0.0.1,fd00::1" value={ctl.get(['settings', 'address']) ?? ''} onChange={(e) => ctl.set(['settings', 'address'], e.target.value)} />
      </Field>
      <Field label={t('pages.inbounds.privatekey')}>
        <div className="ifm-inline">
          <Input value={ctl.get(['settings', 'secretKey']) ?? ''} onChange={(e) => ctl.set(['settings', 'secretKey'], e.target.value)} />
          <Button variant="default" onClick={() => {
            const pair = Wireguard.generateKeypair();
            ctl.set(['settings', 'secretKey'], pair.privateKey);
            ctl.set(['settings', 'pubKey'], pair.publicKey);
          }}>↻</Button>
        </div>
      </Field>
      <Field label={t('pages.inbounds.publicKey')}>
        <Input disabled value={ctl.get(['settings', 'pubKey']) ?? ''} />
      </Field>
      <Field label={t('pages.xray.wireguard.domainStrategy')}>
        <Select
          value={(ctl.get(['settings', 'domainStrategy']) as string) ?? ''}
          onChange={(v) => ctl.set(['settings', 'domainStrategy'], v)}
          options={[{ value: '', label: `(${t('none')})` }, ...WireguardDomainStrategy.map((s) => ({ value: s, label: s }))]}
        />
      </Field>
      <Field label="MTU">
        <Input type="number" min={0} value={ctl.get(['settings', 'mtu']) ?? ''} onChange={(e) => ctl.set(['settings', 'mtu'], Number(e.target.value) || 0)} />
      </Field>
      <Field label={t('pages.xray.outboundForm.workers')}>
        <Input type="number" min={0} value={ctl.get(['settings', 'workers']) ?? ''} onChange={(e) => ctl.set(['settings', 'workers'], Number(e.target.value) || 0)} />
      </Field>
      <Field label={t('pages.inbounds.info.noKernelTun')}>
        <Switch checked={!!ctl.get(['settings', 'noKernelTun'])} onChange={(v) => ctl.set(['settings', 'noKernelTun'], v)} />
      </Field>
      <Field label={t('pages.xray.outboundForm.reserved')}>
        <Input placeholder="comma-separated bytes, e.g. 1,2,3" value={ctl.get(['settings', 'reserved']) ?? ''} onChange={(e) => ctl.set(['settings', 'reserved'], e.target.value)} />
      </Field>

      <Field label={t('pages.inbounds.form.peers')}>
        <Button size="sm" variant="primary" onClick={() => setPeers([...peers, { publicKey: '', psk: '', allowedIPs: ['0.0.0.0/0', '::/0'], endpoint: '', keepAlive: 0 }])} style={{ alignSelf: 'flex-start' }}>+</Button>
      </Field>
      {peers.map((peer, index) => (
        <div key={index}>
          <Field label={t('pages.inbounds.info.peerNumber', { n: index + 1 })}>
            {peers.length > 1 && <Button size="sm" danger onClick={() => setPeers(peers.filter((_, i) => i !== index))}>−</Button>}
          </Field>
          <Field label={t('pages.xray.wireguard.endpoint')}>
            <Input value={peer.endpoint ?? ''} onChange={(e) => patchPeer(index, { endpoint: e.target.value })} />
          </Field>
          <Field label={t('pages.inbounds.publicKey')}>
            <Input value={peer.publicKey ?? ''} onChange={(e) => patchPeer(index, { publicKey: e.target.value })} />
          </Field>
          <Field label="PSK">
            <Input value={peer.psk ?? ''} onChange={(e) => patchPeer(index, { psk: e.target.value })} />
          </Field>
          <Field label={t('pages.xray.wireguard.allowedIPs')}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(peer.allowedIPs ?? []).map((ip, ipIdx) => (
                <div key={ipIdx} className="ifm-inline">
                  <Input value={ip} onChange={(e) => patchPeer(index, { allowedIPs: (peer.allowedIPs ?? []).map((v, i) => (i === ipIdx ? e.target.value : v)) })} />
                  {(peer.allowedIPs ?? []).length > 1 && (
                    <Button size="sm" variant="default" onClick={() => patchPeer(index, { allowedIPs: (peer.allowedIPs ?? []).filter((_, i) => i !== ipIdx) })}>−</Button>
                  )}
                </div>
              ))}
              <Button size="sm" variant="default" onClick={() => patchPeer(index, { allowedIPs: [...(peer.allowedIPs ?? []), ''] })} style={{ alignSelf: 'flex-start' }}>+</Button>
            </div>
          </Field>
          <Field label={t('pages.inbounds.info.keepAlive')}>
            <Input type="number" min={0} value={peer.keepAlive ?? ''} onChange={(e) => patchPeer(index, { keepAlive: Number(e.target.value) || 0 })} />
          </Field>
        </div>
      ))}
    </>
  );
}
