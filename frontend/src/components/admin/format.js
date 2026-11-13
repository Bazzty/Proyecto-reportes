// Utilidades de formato y constantes compartidas por las piezas del panel de administración.

export const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

export const formatDate = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

// Tiempo medio de validación: "—" sin dato, horas con un decimal y coma, y días si pasa de 48 h.
export const formatHours = (hours) => {
  if (hours === null || hours === undefined || Number.isNaN(Number(hours))) return '—';
  const value = Number(hours);
  if (value > 48) return `${Math.round(value / 24)} días`;
  return `${value.toFixed(1).replace('.', ',')} h`;
};

export const validationStyle = (status) => {
  switch (status) {
    case 'valido':    return { bg: '#dcfce7', text: '#166534', label: 'VÁLIDO' };
    case 'rechazado': return { bg: '#fee2e2', text: '#991b1b', label: 'RECHAZADO' };
    default:          return { bg: '#fef9c3', text: '#854d0e', label: 'PENDIENTE' };
  }
};

// "3 lo vieron" / "1 lo vio".
export const confirmationsLabel = (count) => `${count} ${count === 1 ? 'lo vio' : 'lo vieron'}`;

// Líneas del historial de un reporte; solo se incluyen las que tienen datos.
export const buildHistory = (item) => {
  const lines = [];
  const when = (iso) => (iso ? ` · ${formatDateTime(iso)}` : '');

  if (item.created_at) {
    lines.push(`${item.user?.name ? `Creado por ${item.user.name}` : 'Creado'}${when(item.created_at)}`);
  }

  if (item.validation_status === 'valido' && (item.validated_by || item.validated_at || item.auto_validated)) {
    const who = item.validated_by?.name ? `Validado por ${item.validated_by.name}` : 'Validado';
    // auto_validated: lo aprobó su propio autor (un admin). Ya no hay validación automática al crear.
    lines.push(`${who}${item.auto_validated ? ' (su propio reporte)' : ''}${when(item.validated_at)}`);
  }

  if (item.validation_status === 'rechazado' && (item.validated_by || item.validated_at || item.rejection_reason)) {
    const who = item.validated_by?.name ? `Rechazado por ${item.validated_by.name}` : 'Rechazado';
    const reason = item.rejection_reason ? ` · ${item.rejection_reason}` : '';
    lines.push(`${who}${when(item.validated_at)}${reason}`);
  }

  if (item.status_updated_by || item.status_updated_at) {
    const who = item.status_updated_by?.name ? `Estado cambiado por ${item.status_updated_by.name}` : 'Estado cambiado';
    lines.push(`${who}${when(item.status_updated_at)}`);
  }

  return lines;
};

export const MAX_REASON = 500;
export const MAX_BULK = 50;
