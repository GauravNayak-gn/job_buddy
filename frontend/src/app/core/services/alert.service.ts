import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon } from 'sweetalert2';

/**
 * Thin wrapper around SweetAlert2.
 * All user-facing alerts/toasts must go through this service —
 * never call Swal directly in components.
 */
@Injectable({ providedIn: 'root' })
export class AlertService {

  success(message: string, title = 'Success'): void {
    this.fire(title, message, 'success');
  }

  error(message: string, title = 'Error'): void {
    this.fire(title, message, 'error');
  }

  warning(message: string, title = 'Warning'): void {
    this.fire(title, message, 'warning');
  }

  info(message: string, title = 'Info'): void {
    this.fire(title, message, 'info');
  }

  /** Returns true if the user confirmed. */
  async confirm(
    message: string,
    title = 'Are you sure?',
    confirmText = 'Yes',
    cancelText = 'Cancel',
  ): Promise<boolean> {
    const result = await Swal.fire({
      title,
      text: message,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText,
      reverseButtons: true,
    });
    return result.isConfirmed;
  }

  /** Minimal toast in the top-end corner. */
  toast(message: string, icon: SweetAlertIcon = 'success'): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title: message,
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true,
    });
  }

  private fire(title: string, text: string, icon: SweetAlertIcon): void {
    Swal.fire({ title, text, icon });
  }
}
