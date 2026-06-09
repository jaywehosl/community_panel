import * as RDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { CloseOutlined } from '@ant-design/icons';
import { Button } from './Button';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** Convenience confirm/cancel footer. Ignored when `footer` is provided. */
  okText?: ReactNode;
  cancelText?: ReactNode;
  onOk?: () => void;
  okDanger?: boolean;
  okDisabled?: boolean;
  confirmLoading?: boolean;
  width?: number | string;
  /** Hide the default header close button. */
  hideClose?: boolean;
}

/**
 * Accessible modal dialog (Radix). Focus-trap, ESC, scroll-lock and overlay
 * click-to-close are handled by Radix; we only style it.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  footer,
  okText = 'OK',
  cancelText = 'Cancel',
  onOk,
  okDanger,
  okDisabled,
  confirmLoading,
  width,
  hideClose,
}: DialogProps) {
  const resolvedFooter =
    footer !== undefined
      ? footer
      : onOk
        ? (
            <>
              <Button onClick={() => onOpenChange(false)}>{cancelText}</Button>
              <Button variant="primary" danger={okDanger} disabled={okDisabled} loading={confirmLoading} onClick={onOk}>
                {okText}
              </Button>
            </>
          )
        : null;

  // Form/content dialogs (inbound/outbound/rule/…) are unified to one standard
  // size — the "Add Inbound" reference (780 × fixed height) — so every form
  // modal is identical and never resizes/jumps between tabs; the body is the
  // single scroll region. Narrow confirms (<520) keep their own width + auto
  // height.
  const isTall = typeof width === 'number' && width >= 520;
  const resolvedWidth = isTall ? 780 : width;

  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="ds-dialog__overlay" />
        {/* fixed flex-centring viewport → integer position, no translate() layer
            that settles and nudges text on open (see REDESIGN_TODO). */}
        <div className="ds-dialog__viewport">
          <RDialog.Content
            className={`ds-dialog__content${isTall ? ' ds-dialog__content--tall' : ''}`}
            style={resolvedWidth ? { width: typeof resolvedWidth === 'number' ? `${resolvedWidth}px` : resolvedWidth } : undefined}
            aria-describedby={undefined}
          >
            <div className="ds-dialog__header">
              <RDialog.Title className="ds-dialog__title">{title}</RDialog.Title>
              {!hideClose && (
                <RDialog.Close asChild>
                  <button className="ds-dialog__close" aria-label="Close">
                    <CloseOutlined />
                  </button>
                </RDialog.Close>
              )}
            </div>
            <div className="ds-dialog__body">{children}</div>
            {resolvedFooter != null && <div className="ds-dialog__footer">{resolvedFooter}</div>}
          </RDialog.Content>
        </div>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
