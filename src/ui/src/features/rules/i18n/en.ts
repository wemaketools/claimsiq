import type { Catalog } from '../../../lib/i18n';

const en = {
  nav: 'Rules',
  title: 'Rules',
  subtitle:
    'The targets and thresholds every claims screen and CSV export is worked out from. A saved change applies at once, in this data set only.',
  loadFailed: 'The rules could not be loaded',
  meta: {
    seeded: 'Version {version} · the spec’s rules, never changed',
    saved: 'Version {version} · last saved {time} by {actor}',
  },
  restricted: {
    title: 'Read-only for this persona',
    body: 'Only the Head of Claims and Finance can change the rules. You are viewing as {persona}, so the rules are shown but cannot be edited.',
  },
  conflict: {
    title: 'The rules were saved by someone else first',
    body: 'The page now shows the latest rules. Your change was not saved: make it again on top of them.',
  },
  group: {
    stages: {
      title: 'Stage targets',
      subtitle: 'Business days a claim may stay in a stage before it is past its target.',
    },
    suppliers: {
      title: 'Supplier waits',
      subtitle:
        'When a supplier request counts as held up, and how much evidence an average needs.',
    },
    money: {
      title: 'Money thresholds',
      subtitle: 'What counts as a material reserve movement and as a high-value claim.',
    },
    severity: {
      title: 'Warnings, severity and ageing',
      subtitle:
        'How early a target is flagged as approaching, what raises severity, and how open claims are aged.',
    },
  },
  field: {
    stage: 'Stage target: {stage}',
    supplier_wait_target_business_days: 'Supplier wait target',
    supplier_min_sample: 'Supplier sample minimum',
    material_reserve_delta_absolute_BWP: 'Material reserve change: amount',
    material_reserve_delta_percent: 'Material reserve change: percent',
    high_value_incurred_BWP: 'High-value line',
    approaching_window_business_days: 'Approaching window',
    severity_high_sla_days_late: 'High severity: days past target',
    severity_high_reserve_change_min_age_days: 'High severity: reserve change, claim age',
    age_bucket_upper_days: 'Age buckets: upper limits',
  },
  hint: {
    supplier_wait_target_business_days: 'A request waiting longer than this is past target.',
    supplier_min_sample: 'An average wait or wait percentile shows only from this many requests.',
    material_reserve_delta_absolute_BWP: 'A reserve move of at least this amount is material.',
    material_reserve_delta_percent:
      'A reserve move of at least this share of the earlier amount is material.',
    high_value_incurred_BWP: 'An open claim with incurred at or above this is high value.',
    approaching_window_business_days:
      'A stage target is approaching within this many business days of it.',
    severity_high_sla_days_late: 'A claim this many business days past target is high severity.',
    severity_high_reserve_change_min_age_days:
      'A material reserve change on a claim older than this is high severity.',
    age_bucket_upper_days:
      'Whole days, increasing, separated by commas. Older claims fall in the last bucket.',
  },
  value: {
    businessDays_one: '{count} business day',
    businessDays_other: '{count} business days',
    calendarDays_one: '{count} day',
    calendarDays_other: '{count} days',
    requests_one: '{count} request',
    requests_other: '{count} requests',
    percent: '{value}%',
    buckets: '{value} days',
    none: 'No target',
  },
  unit: {
    businessDays: 'business days',
    calendarDays: 'days',
    requests: 'requests',
    money: 'BWP',
    percent: '%',
  },
  currentDefault: 'Saved {value} · spec default {default}',
  changedFromDefault: 'Changed from the spec',
  error: {
    number: 'Enter a number.',
    whole: 'Must be a whole number.',
    min: 'Must be at least {min}.',
    max: 'Must be at most {max}.',
    increasing: 'Each limit must be larger than the one before.',
    invalid: 'Enter a valid value.',
    buckets: 'Enter whole days separated by commas, for example 7, 30, 60, 90.',
  },
  action: {
    save: 'Save changes',
    discard: 'Discard changes',
    restore: 'Restore defaults',
  },
  save: {
    title: 'Save the rules?',
    scope: '{count} rules in the {dataSet} data set',
    consequence:
      'Every screen and CSV export is worked out from the new rules at once. Each change is logged with your name and the time.',
    confirm: 'Save changes',
    done: 'The rules were saved (version {version}).',
    change: '{rule}: {from} to {to}',
  },
  restore: {
    title: 'Restore the spec’s rules?',
    scope: 'Every rule in the {dataSet} data set',
    consequence:
      'The spec’s targets and thresholds replace the saved ones everywhere at once. The restore is logged with your name and the time, and the earlier values stay in the history.',
    confirm: 'Restore defaults',
    done: 'The spec’s rules are back (version {version}).',
  },
  audit: {
    title: 'Change history',
    subtitle:
      'Newest first. Every saved change names who made it, when, and the old and new value.',
    caption: 'History of changes to the rules',
    column: {
      time: 'When',
      actor: 'Who',
      rule: 'Rule',
      from: 'Was',
      to: 'Now',
      action: 'Change',
    },
    action: { CHANGED: 'Saved', RESTORED: 'Restored' },
    empty: {
      title: 'No changes yet',
      description: 'The spec’s rules are in force. A saved change appears here.',
    },
  },
  values: {
    caption: 'The rules of the {group} group',
    rule: 'Rule',
    saved: 'Saved',
    default: 'Spec default',
  },
} satisfies Catalog;

export default en;
