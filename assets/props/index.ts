import type { PropDef } from '../../render/props/api';
import arrow_down from './arrow_down';
import arrow_up from './arrow_up';
import bill from './bill';
import coin from './coin';
import credit_card from './credit_card';
import house from './house';
import money_bag from './money_bag';
import piggy_bank from './piggy_bank';
import tax_form from './tax_form';

export const PROPS: Record<string, PropDef> = Object.fromEntries(
  [bill, coin, money_bag, house, credit_card, piggy_bank, tax_form, arrow_up, arrow_down].map((p) => [p.name, p]),
);
