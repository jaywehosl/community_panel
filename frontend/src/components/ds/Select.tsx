import * as RSelect from '@radix-ui/react-select';
import { CheckOutlined, DownOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';

export interface SelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  value?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Select({ value, onChange, options, placeholder, disabled, id, className = '' }: SelectProps) {
  return (
    <RSelect.Root value={value} onValueChange={onChange} disabled={disabled}>
      <RSelect.Trigger id={id} className={['ds-select', className].filter(Boolean).join(' ')} aria-label={placeholder}>
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon className="ds-select__icon"><DownOutlined /></RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content className="ds-select__content" position="popper" sideOffset={6}>
          <RSelect.Viewport className="ds-select__viewport">
            {options.map((opt) => (
              <RSelect.Item key={opt.value} value={opt.value} disabled={opt.disabled} className="ds-select__item">
                <RSelect.ItemText>{opt.label}</RSelect.ItemText>
                <RSelect.ItemIndicator className="ds-select__indicator"><CheckOutlined /></RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
