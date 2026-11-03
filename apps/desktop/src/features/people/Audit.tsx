import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardText } from '@phosphor-icons/react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/layout/CommandShell';
import { Panel } from '../../components/ui/list';
import { roleLabel } from '../../lib/roles';
import { cn } from '../../lib/utils';

type Entry = { id: string; at: string; action: string; detail?: string; actor: { name: string; role: string } | null; target: { id: string; name: string } | null };
type Kind = 'actions' | 'access';

const ACTION: Record<string, string> = {
  staff_created: 'created a staff account for', user_removed: 'removed the account of', responder_removed: 'removed responder status from',
  suspended: 'suspended', restored: 'restored', application_approved: 'approved the application of', application_rejected: 'rejected the application of',
  certificate_revoked: 'revoked a certificate of', role_changed: 'changed the role of', feedback_updated: 'updated feedback from',
  clinician_record: 'opened, for a consultation, the record of', admin_record: 'opened the record of', qr_profile: 'opened the medical ID link of',
};

/** Administrators: what other administrators did, and every opening of someone's medical record. Read only. */
export const Audit = () => {
  const [kind, setKind] = useState<Kind>('actions');
  const [items, setItems] = useState<Entry[] | null>(null);
  useEffect(() => { setItems(null); api.get<Entry[]>('/admin/audit', { params: { kind } }).then(r => setItems(r.data)).catch(() => setItems([])); }, [kind]);

  return (
    <>
      <PageHeader icon={ClipboardText} title="Audit" subtitle="Administrative actions and medical record access. Nobody can edit or delete these entries." />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-1 rounded-xl bg-card border border-border p-1 shadow-sm w-fit" role="tablist">
          {([['actions', 'Admin actions'], ['access', 'Record access']] as [Kind, string][]).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={kind === k} onClick={() => setKind(k)}
              className={cn('px-3.5 py-1.5 text-sm rounded-lg transition-colors', kind === k ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground')}>{label}</button>
          ))}
        </div>
        <Panel>
          {!items && <p className="px-5 py-6 text-sm text-muted-foreground">Loading…</p>}
          {items?.length === 0 && <p className="px-5 py-10 text-center text-muted-foreground">Nothing recorded yet.</p>}
          {items?.map(e => (
            <div key={e.id} className="grid grid-cols-[150px_1fr] gap-4 px-5 py-3 text-[14px]">
              <span className="num text-muted-foreground">{new Date(e.at).toLocaleString('en-GB', { hourCycle: 'h23', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              <span>
                <span className="font-semibold">{e.actor ? `${e.actor.name}` : 'Someone with the link'}</span>
                {e.actor && <span className="text-muted-foreground"> ({roleLabel(e.actor.role)})</span>}{' '}
                {ACTION[e.action] ?? e.action}{' '}
                {e.target ? <Link to={`/command/admin/users/${e.target.id}`} className="font-semibold text-primary hover:underline">{e.target.name}</Link> : 'a removed account'}
                {e.detail && <span className="block text-muted-foreground">{e.detail}</span>}
              </span>
            </div>
          ))}
        </Panel>
      </div>
    </>
  );
};
