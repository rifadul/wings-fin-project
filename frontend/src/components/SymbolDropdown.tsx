import { SYMBOLS } from "../constants/symbols";

interface SymbolDropdownProps {
  value: string;
  onChange: (code: string) => void;
}

/**
 * Controlled dropdown to switch the displayed instrument between
 * "Index (DSEX)" and "Stock (GP)". `value` is the symbol code.
 */
export default function SymbolDropdown({ value, onChange }: SymbolDropdownProps) {
  return (
    <label className="symbol-dropdown">
      <span className="symbol-dropdown__label">View</span>
      <select
        className="symbol-dropdown__select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {SYMBOLS.map((s) => (
          <option key={s.code} value={s.code}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}
