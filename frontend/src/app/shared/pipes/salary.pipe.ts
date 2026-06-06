import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'salary', standalone: true })
export class SalaryPipe implements PipeTransform {
  transform(min: number | null | undefined, max?: number | null): string {
    if (min == null && max == null) {
      return 'Salary not disclosed';
    }
    if (min != null && max != null) {
      return `INR ${min} - ${max}`;
    }
    if (min != null) {
      return `From INR ${min}`;
    }
    return `Up to INR ${max}`;
  }
}
