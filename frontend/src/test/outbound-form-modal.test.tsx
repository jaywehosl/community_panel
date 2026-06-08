import { describe, it, expect } from 'vitest';

import OutboundFormModal from '@/pages/xray/outbounds/OutboundFormModal';
import { OutboundProtocols } from '@/schemas/primitives';
import { renderWithProviders, dsFieldLabels } from './test-utils';

function renderModal(outbound: Record<string, unknown> | null = null) {
  return renderWithProviders(
    <OutboundFormModal
      open
      outbound={outbound}
      existingTags={[]}
      onClose={() => {}}
      onConfirm={() => {}}
    />,
  );
}

describe('OutboundFormModal', () => {
  it('renders add mode without crashing', () => {
    renderModal(null);
    expect(document.querySelector('.ds-dialog__content')).toBeTruthy();
    expect(dsFieldLabels().length).toBeGreaterThan(0);
  });

  it('field structure is stable for every protocol', () => {
    const protocols = Object.values(OutboundProtocols);
    expect(protocols.length).toBeGreaterThan(3);
    for (const proto of protocols) {
      const { unmount } = renderModal({ protocol: proto });
      expect(dsFieldLabels()).toMatchSnapshot(proto);
      unmount();
    }
  });
});
