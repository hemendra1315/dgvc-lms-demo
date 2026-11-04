import { useDemo } from '../../data/store';
import { PageHeader } from '../../components/ui';

export function AuditPage() {
  const audit = useDemo((s) => s.audit);
  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Resource changes recorded in this demo session (newest first)" />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm" data-testid="audit-table">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-line">
              <th className="font-medium px-4 py-3">When</th>
              <th className="font-medium px-3 py-3">Actor</th>
              <th className="font-medium px-3 py-3">Action</th>
              <th className="font-medium px-3 py-3">Entity</th>
              <th className="font-medium px-4 py-3">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {audit.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2.5 whitespace-nowrap text-muted">{new Date(a.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{a.actor}</td>
                <td className="px-3 py-2.5 whitespace-nowrap font-medium">{a.action}</td>
                <td className="px-3 py-2.5">{a.entity}</td>
                <td className="px-4 py-2.5 text-muted">{a.detail ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
