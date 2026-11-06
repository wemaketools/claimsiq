/** The rule editor: every value as an input with the saved and default value beside it; Save and Restore defaults are confirmed and audited. */
import { useMemo, useState } from 'react';

import { endpoints } from '../../../../contracts/index';
import type { RuleConfigState } from '../../../../contracts/index';
import { isApiError } from '../../api/client';
import { invalidateApiQueries, useApiMutation } from '../../api/hooks';
import { useAppSelector } from '../../app/hooks';
import {
  Button,
  Card,
  ConfirmActionDialog,
  NumberInput,
  TextField,
  UnsavedChangesGuard,
  useToast,
} from '../../components/ui';
import { t } from '../../lib/i18n';
import { changedFields, checkDraft, draftOf } from './draft';
import type { Draft } from './draft';
import { RULE_GROUPS, formatRuleValue, ruleFieldsOf, ruleFieldInfo, unitOf } from './fields';
import type { RuleFieldInfo } from './fields';

interface RuleInputProps {
  readonly info: RuleFieldInfo;
  readonly value: string;
  readonly error: string | undefined;
  readonly saved: string | undefined;
  readonly standard: string | undefined;
  readonly onChange: (value: string) => void;
}

function RuleInput({ info, value, error, saved, standard, onChange }: RuleInputProps) {
  const hint = (
    <>
      {info.hint !== null && <span>{info.hint}</span>}
      <span className="ciq-cell-sub">
        {t('rules.currentDefault', {
          value: formatRuleValue(info.kind, saved ?? null),
          default: formatRuleValue(info.kind, standard ?? null),
        })}
      </span>
    </>
  );
  if (info.kind === 'buckets') {
    return (
      <TextField label={info.label} hint={hint} error={error} value={value} onChange={onChange} />
    );
  }
  return (
    <NumberInput
      label={info.label}
      hint={hint}
      error={error}
      value={value}
      onChange={onChange}
      places={info.kind === 'money' || info.kind === 'percent' ? 2 : 0}
      suffix={unitOf(info.kind)}
    />
  );
}

export interface RulesEditorProps {
  readonly data: RuleConfigState;
  /** Another save got in first: the page shows the latest rules and says so. */
  readonly onConflict: () => void;
  readonly onSaved: () => void;
}

/** Mount it per version of the rules (`key`): every version starts from its own saved values. */
export function RulesEditor({ data, onConflict, onSaved }: RulesEditorProps) {
  const toast = useToast();
  const dataSet = useAppSelector((state) => state.dataContext.dataSet);
  const saved = useMemo(() => draftOf(data.config.claims), [data]);
  const defaults = useMemo(() => draftOf(data.defaults.claims), [data]);
  const fields = useMemo(() => ruleFieldsOf(data.config.claims), [data]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [confirming, setConfirming] = useState<'save' | 'restore' | null>(null);
  const save = useApiMutation(endpoints.ruleConfigSave);
  const restore = useApiMutation(endpoints.ruleConfigRestore);

  const check = checkDraft(draft);
  const changed = changedFields(saved, draft);
  const saving = check.valid ? draftOf(check.claims) : null;
  const changes = changed.map((field) => {
    const info = ruleFieldInfo(field);
    return {
      field,
      text: t('rules.save.change', {
        rule: info.label,
        from: formatRuleValue(info.kind, saved[field] ?? null),
        to: formatRuleValue(info.kind, saving?.[field] ?? null),
      }),
    };
  });
  const atDefaults = Object.keys(defaults).every((field) => defaults[field] === saved[field]);

  const close = (): void => {
    save.reset();
    restore.reset();
    setConfirming(null);
  };

  /** Runs a save or a restore; the same answer to a conflict and to success for both. */
  const submit = async (run: () => Promise<RuleConfigState>, done: string): Promise<void> => {
    try {
      const next = await run();
      invalidateApiQueries();
      close();
      onSaved();
      toast.show(t(done, { version: next.version }), 'success');
    } catch (error) {
      if (isApiError(error) && error.kind === 'conflict') {
        invalidateApiQueries();
        close();
        onConflict();
      }
    }
  };

  return (
    <div className="ciq-stack">
      <UnsavedChangesGuard when={changed.length > 0} />
      {RULE_GROUPS.map((group) => (
        <Card
          key={group}
          title={t(`rules.group.${group}.title`)}
          subtitle={t(`rules.group.${group}.subtitle`)}
        >
          <div className="ciq-form-grid">
            {fields
              .filter((info) => info.group === group)
              .map((info) => (
                <RuleInput
                  key={info.field}
                  info={info}
                  value={draft[info.field] ?? ''}
                  error={check.errors[info.field]}
                  saved={saved[info.field]}
                  standard={defaults[info.field]}
                  onChange={(value) => setDraft((current) => ({ ...current, [info.field]: value }))}
                />
              ))}
          </div>
        </Card>
      ))}
      <div className="ciq-inline">
        <Button
          variant="primary"
          icon="check"
          disabled={changed.length === 0 || !check.valid}
          onClick={() => setConfirming('save')}
        >
          {t('rules.action.save')}
        </Button>
        <Button disabled={changed.length === 0} onClick={() => setDraft(saved)}>
          {t('rules.action.discard')}
        </Button>
        <Button icon="refresh" disabled={atDefaults} onClick={() => setConfirming('restore')}>
          {t('rules.action.restore')}
        </Button>
      </div>
      <ConfirmActionDialog
        open={confirming === 'save'}
        title={t('rules.save.title')}
        scope={t('rules.save.scope', { count: changed.length, dataSet })}
        consequence={t('rules.save.consequence')}
        confirmLabel={t('rules.save.confirm')}
        pending={save.pending}
        error={save.error}
        onCancel={close}
        onConfirm={async () => {
          if (check.valid) {
            await submit(
              () => save.mutate({ body: { version: data.version, claims: check.claims } }),
              'rules.save.done',
            );
          }
        }}
      >
        <ul className="ciq-stack">
          {changes.map((line) => (
            <li key={line.field}>{line.text}</li>
          ))}
        </ul>
      </ConfirmActionDialog>
      <ConfirmActionDialog
        open={confirming === 'restore'}
        title={t('rules.restore.title')}
        scope={t('rules.restore.scope', { dataSet })}
        consequence={t('rules.restore.consequence')}
        confirmLabel={t('rules.restore.confirm')}
        pending={restore.pending}
        error={restore.error}
        onCancel={close}
        onConfirm={() =>
          submit(() => restore.mutate({ body: { version: data.version } }), 'rules.restore.done')
        }
      />
    </div>
  );
}
