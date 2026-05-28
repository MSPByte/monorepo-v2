import { afterEach, describe, expect, it, vi } from 'vitest';
import { SkuCatalogService } from './sku-catalog-service.js';

describe('SkuCatalogService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    SkuCatalogService.clearCacheForTests();
  });

  it('maps skuPartNumber values to friendly product names from the Microsoft CSV', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        [
          'Product_Display_Name,String_Id,GUID',
          '"Microsoft 365 E3",SPE_E3,00000000-0000-0000-0000-000000000001',
          '"Microsoft Defender, Plan 2",DEFENDER_PLAN2,00000000-0000-0000-0000-000000000002'
        ].join('\n'),
        { status: 200 }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const names = await SkuCatalogService.resolve();

    expect(names.get('SPE_E3')).toBe('Microsoft 365 E3');
    expect(names.get('DEFENDER_PLAN2')).toBe('Microsoft Defender, Plan 2');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches the catalog after the first successful fetch', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response('Product_Display_Name,String_Id\n"Microsoft 365 E5",SPE_E5', {
        status: 200
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await SkuCatalogService.resolve();
    await SkuCatalogService.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
