// Estados de gestión de un reporte; deben coincidir con los que acepta el backend.
export const REPORT_STATUSES = ['Pendiente', 'En Progreso', 'Resuelto'];

// Estado que ve el autor: mientras la moderación no lo apruebe, el estado de gestión
// ("Pendiente", "Resuelto"…) no aplica y se muestra la moderación en su lugar.
// Sin validation_status (respuestas antiguas) se trata como validado.
export const reportDisplayStatus = (report) => {
  switch (report?.validation_status) {
    case 'pendiente': return 'En revisión';
    case 'rechazado': return 'Rechazado';
    // Aprobado pero aún sin atender: "Pendiente" se confundiría con "pendiente de revisión".
    case 'valido':    return report.status === 'Pendiente' ? 'Aprobado' : (report.status ?? '');
    default:          return report?.status ?? '';
  }
};

export const isValidated = (report) =>
  report?.validation_status !== 'pendiente' && report?.validation_status !== 'rechazado';
