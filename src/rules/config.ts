/** The rule config schema lives in `src/contracts` (the API carries it); the engine reads every threshold from it. */
import { RuleConfig } from '../contracts/index.js';

export { BUSINESS_DAY_CODES, ClaimsRuleConfig, RuleConfig } from '../contracts/index.js';

export function parseRuleConfig(input: unknown): RuleConfig {
  return RuleConfig.parse(input);
}
