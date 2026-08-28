import { PageHeader, Card, Badge } from '../../components/ui';
import { Construction } from 'lucide-react';

export default function ModuleStub({
  name,
  phase = 'Phase 2',
  description,
  features,
}: {
  name: string;
  phase?: string;
  description?: string;
  features?: string[];
}) {
  return (
    <div>
      <PageHeader
        title={name}
        description={description ?? `This module ships in ${phase}. The route is wired so navigation, auth, and layout are working.`}
      />
      <Card className="p-10">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Construction className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-semibold text-slate-900">{name} — coming soon</div>
            <p className="mt-1 text-sm text-slate-600">
              {description ?? `The full ${name.toLowerCase()} module is scheduled for ${phase}. The navigation, sidebar grouping, and backend route stub are already in place — so adding the real implementation later is a one-file change on each side.`}
            </p>
            <div className="mt-3">
              <Badge variant="info">{phase}</Badge>
            </div>
            {features && (
              <ul className="mt-4 grid sm:grid-cols-2 gap-2 text-sm text-slate-700">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}