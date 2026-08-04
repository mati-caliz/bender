import { decodeJwt } from '@/lib/jwt';
import { formatDateTime } from '@/lib/format';
import { Badge } from '@/ui/components/primitives';

export const JwtPanel = ({ value }: { value: string }) => {
  const decoded = decodeJwt(value);
  if (!decoded) return null;

  return (
    <div className="jwt-panel">
      <div className="row wrap">
        <Badge tone="info">JWT</Badge>
        {decoded.expiresAt ? (
          <Badge tone={decoded.expired ? 'danger' : 'success'}>
            {decoded.expired ? 'vencido' : 'vigente'} · {formatDateTime(decoded.expiresAt.getTime())}
          </Badge>
        ) : null}
        {decoded.issuedAt ? <Badge>emitido {formatDateTime(decoded.issuedAt.getTime())}</Badge> : null}
      </div>
      <pre className="jwt-json">{JSON.stringify(decoded.payload, null, 2)}</pre>
    </div>
  );
};
