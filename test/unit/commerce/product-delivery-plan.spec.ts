/// <reference types="jest" />
import { ProductDeliveryMode } from '@prisma/client';
import { buildProductDeliveryPlan } from '../../../src/modules/commerce/application/product-delivery-plan';

const corona = {
  id: 'order-corona',
  itemId: 'corona',
  clubId: 'club-1',
  nameSnapshot: 'Corona',
  quantity: 3,
  productDeliveryMode: ProductDeliveryMode.SEPARATE,
};
const water = {
  id: 'order-water',
  itemId: 'water',
  clubId: 'club-1',
  nameSnapshot: 'Agua',
  quantity: 2,
  productDeliveryMode: ProductDeliveryMode.GROUPED,
};

describe('buildProductDeliveryPlan', () => {
  it('supports mixed per-product grouping', () => {
    const groups = buildProductDeliveryPlan(false, [corona, water]);

    expect(groups).toHaveLength(4);
    expect(groups.map((group) => group.map((item) => [item.itemId, item.quantity]))).toEqual([
      [['corona', 1]],
      [['corona', 1]],
      [['corona', 1]],
      [['water', 2]],
    ]);
  });

  it('combines every product without changing quantities', () => {
    expect(buildProductDeliveryPlan(true, [corona, water])).toEqual([[corona, water]]);
  });
});
