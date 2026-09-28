'use client';

import { humanize, type StageField } from '@solar/shared';
import { useUserOptions } from '@/hooks/api/use-team';
import { roleShort } from '@/lib/roles';
import { toDateInputValue } from '@/lib/utils';
import { CurrencyInput } from '@/components/ui/currency-input';
import { DateInput } from '@/components/ui/date-input';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  field: StageField;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  disabled?: boolean;
}

const asString = (v: unknown) => (v === undefined || v === null ? '' : String(v));
const toNumber = (s: string) => (s === '' ? undefined : Number(s));

/** Renders one `StageDefinition.fields[]` entry as the right control. Values are stored in `stage.data`. */
export function StageFieldInput({ field, value, onChange, error, disabled }: Props) {
  const common = { label: field.label, required: field.required, error };
  switch (field.type) {
    case 'textarea':
      return (
        <FormField {...common} className="sm:col-span-2">
          <Textarea value={asString(value)} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} disabled={disabled} />
        </FormField>
      );
    case 'number':
      return (
        <FormField {...common}>
          <Input type="number" inputMode="decimal" value={asString(value)} onChange={(e) => onChange(toNumber(e.target.value))} placeholder={field.placeholder} disabled={disabled} />
        </FormField>
      );
    case 'currency':
      return (
        <FormField {...common}>
          <CurrencyInput value={asString(value)} onChange={(e) => onChange(toNumber(e.target.value))} placeholder={field.placeholder ?? '0'} disabled={disabled} />
        </FormField>
      );
    case 'date':
      return (
        <FormField {...common}>
          <DateInput value={toDateInputValue(asString(value))} onChange={(e) => onChange(e.target.value || undefined)} disabled={disabled} />
        </FormField>
      );
    case 'select':
      return (
        <FormField {...common}>
          <Select
            value={asString(value)}
            onChange={(e) => onChange(e.target.value || undefined)}
            placeholder="Select…"
            options={(field.options ?? []).map((o) => ({ value: o, label: humanize(o) }))}
            disabled={disabled}
          />
        </FormField>
      );
    case 'boolean':
      return (
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-sm font-medium">
          {field.label}
          <Switch checked={value === true} onCheckedChange={(c) => onChange(c)} disabled={disabled} />
        </label>
      );
    case 'user':
      return <UserField {...{ field, value, onChange, error, disabled }} />;
    default:
      return (
        <FormField {...common}>
          <Input value={asString(value)} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} disabled={disabled} />
        </FormField>
      );
  }
}

function UserField({ field, value, onChange, error, disabled }: Props) {
  const role = field.roleFilter?.length === 1 ? field.roleFilter[0] : undefined;
  const { data, isLoading } = useUserOptions(role);
  const options = (data ?? []).filter((u) => !field.roleFilter?.length || field.roleFilter.includes(u.roleKey)).map((u) => ({ value: u.id, label: `${u.name} · ${roleShort(u.roleKey)}` }));
  return (
    <FormField label={field.label} required={field.required} error={error}>
      <Select value={asString(value)} onChange={(e) => onChange(e.target.value || undefined)} placeholder={isLoading ? 'Loading…' : 'Select a person…'} options={options} disabled={disabled} />
    </FormField>
  );
}
