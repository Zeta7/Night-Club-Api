/// <reference types="jest" />
import { UbigeoService } from '../../../src/modules/prelaunch/infrastructure/ubigeo.service';

describe('UbigeoService', () => {
  const service = new UbigeoService();

  it('resuelve un distrito únicamente cuando pertenece a la provincia y departamento seleccionados', () => {
    const catalog = service.list();
    const department = catalog.departments.find((item) => item.name === 'La Libertad');
    const province = catalog.provinces.find((item) => item.departmentId === department?.id && item.name === 'Trujillo');
    const district = catalog.districts.find((item) => item.provinceId === province?.id && item.name === 'Víctor Larco Herrera');

    expect(department).toBeDefined();
    expect(province).toBeDefined();
    expect(district).toBeDefined();
    expect(service.resolve({
      departmentId: department!.id,
      provinceId: province!.id,
      districtId: district!.id,
      ubigeoCode: district!.ubigeo,
    })).toMatchObject({
      departmentName: 'La Libertad',
      provinceName: 'Trujillo',
      districtName: 'Víctor Larco Herrera',
      ubigeoCode: district!.ubigeo,
    });
  });

  it('rechaza combinaciones UBIGEO manipuladas', () => {
    const catalog = service.list();
    const lima = catalog.departments.find((item) => item.name === 'Lima')!;
    const trujillo = catalog.provinces.find((item) => item.name === 'Trujillo')!;
    const district = catalog.districts.find((item) => item.provinceId === trujillo.id)!;

    expect(() => service.resolve({ departmentId: lima.id, provinceId: trujillo.id, districtId: district.id, ubigeoCode: district.ubigeo })).toThrow();
  });
});
