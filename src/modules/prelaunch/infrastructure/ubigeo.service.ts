import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { badRequest } from '../../../shared/presentation/api-exception';

type Department = { id: number; departamento: string; ubigeo: string };
type Province = { id: number; provincia: string; ubigeo: string; departamento_id: number };
type District = { id: number; distrito: string; ubigeo: string; provincia_id: number; departamento_id: number };

@Injectable()
export class UbigeoService {
  private readonly departments = this.read<{ ubigeo_departamentos: Department[] }>('peru_departments.json').ubigeo_departamentos;
  private readonly provinces = this.read<{ ubigeo_provincias: Province[] }>('peru_provinces.json').ubigeo_provincias;
  private readonly districts = this.read<{ ubigeo_distritos: District[] }>('peru_districts.json').ubigeo_distritos;

  list() {
    return {
      departments: this.departments.map((item) => ({ id: item.id, name: titleCase(item.departamento), ubigeo: item.ubigeo })),
      provinces: this.provinces.map((item) => ({ id: item.id, departmentId: item.departamento_id, name: titleCase(item.provincia), ubigeo: item.ubigeo })),
      districts: this.districts.map((item) => ({ id: item.id, departmentId: item.departamento_id, provinceId: item.provincia_id, name: titleCase(item.distrito), ubigeo: item.ubigeo })),
    };
  }

  resolve(input: { departmentId: number; provinceId: number; districtId: number; ubigeoCode: string }) {
    const department = this.departments.find((item) => item.id === input.departmentId);
    const province = this.provinces.find((item) => item.id === input.provinceId && item.departamento_id === input.departmentId);
    const district = this.districts.find((item) => item.id === input.districtId && item.provincia_id === input.provinceId && item.departamento_id === input.departmentId && item.ubigeo === input.ubigeoCode);
    if (!department || !province || !district) {
      throw badRequest('INVALID_UBIGEO', 'Selecciona un departamento, provincia y distrito válidos.');
    }
    return {
      departmentId: department.id,
      provinceId: province.id,
      districtId: district.id,
      departmentName: titleCase(department.departamento),
      provinceName: titleCase(province.provincia),
      districtName: titleCase(district.distrito),
      ubigeoCode: district.ubigeo,
    };
  }

  private read<T>(fileName: string): T {
    const candidates = [
      join(__dirname, '..', 'data', fileName),
      join(process.cwd(), 'src', 'modules', 'prelaunch', 'data', fileName),
    ];
    const path = candidates.find((candidate) => existsSync(candidate));
    if (!path) throw new Error(`No se encontró el catálogo UBIGEO ${fileName}.`);
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  }
}

const accentWords = new Map([
  ['ANCASH', 'Áncash'], ['APURIMAC', 'Apurímac'], ['HUANUCO', 'Huánuco'], ['JUNIN', 'Junín'],
  ['MARTIN', 'Martín'], ['VICTOR', 'Víctor'], ['JESUS', 'Jesús'], ['MARIA', 'María'],
  ['JOSE', 'José'], ['NICOLAS', 'Nicolás'], ['SIMON', 'Simón'], ['RAMON', 'Ramón'],
]);

const titleCase = (value: string) => value
  .split(/(\s+|-)/)
  .map((word) => accentWords.get(word) ?? word.toLocaleLowerCase('es-PE').replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase('es-PE')))
  .join('');
