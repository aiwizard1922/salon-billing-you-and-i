/** Human-readable services (+ stylist when known) for lists and CRM */
export function formatAppointmentServiceSummary(appt) {
  if (Array.isArray(appt?.serviceLines) && appt.serviceLines.length > 0) {
    return appt.serviceLines
      .map((L) => {
        if (L.staffName) return `${L.name} (${L.staffName})`;
        return L.name;
      })
      .join(', ');
  }
  const svc = appt?.services;
  if (Array.isArray(svc) && svc.length) return svc.join(', ');
  return '—';
}
