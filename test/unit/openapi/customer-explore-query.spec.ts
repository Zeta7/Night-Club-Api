/// <reference types="jest" />
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CustomerExploreQueryDto } from '../../../src/modules/clubs/presentation/dto/customer-explore-query.dto';

describe('CustomerExploreQueryDto', () => {
  const validate = (q?: string, page = 1) =>
    validateSync(plainToInstance(CustomerExploreQueryDto, q == null ? { page } : { q, page }));

  it('accepts the unfiltered national catalog and later pages', () => {
    expect(validate()).toHaveLength(0);
    expect(validate(undefined, 2)).toHaveLength(0);
  });

  it('keeps search and page bounds', () => {
    expect(validate('x')).not.toHaveLength(0);
    expect(validate('')).not.toHaveLength(0);
    expect(validate('  ')).not.toHaveLength(0);
    expect(validate('li')).toHaveLength(0);
    expect(validate(undefined, 0)).not.toHaveLength(0);
  });
});
