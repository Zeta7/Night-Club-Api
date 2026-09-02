import { ProductDeliveryMode } from '@prisma/client';

export type ProductDeliveryPlanItem = {
  id: string;
  itemId: string;
  clubId: string;
  nameSnapshot: string;
  quantity: number;
  productDeliveryMode: ProductDeliveryMode;
};

export function buildProductDeliveryPlan(
  combineProducts: boolean,
  items: ProductDeliveryPlanItem[],
): ProductDeliveryPlanItem[][] {
  if (items.length === 0) return [];
  if (combineProducts) return [items];

  return items.flatMap((item) => {
    if (item.productDeliveryMode === ProductDeliveryMode.GROUPED) return [[item]];
    return Array.from({ length: item.quantity }, () => [{ ...item, quantity: 1 }]);
  });
}
