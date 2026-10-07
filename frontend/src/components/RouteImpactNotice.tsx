import { Link } from 'react-router-dom';
import { Construction, ShieldCheck, ArrowRight, AlertTriangle } from 'lucide-react';
import type { RoutePlan, IncidentSummary, Node, Edge } from '../types';
import { IncidentBadge } from './IncidentBadge';

interface Props { plan: RoutePlan; incidents: IncidentSummary[]; nodes: Node[]; edges: Edge[] }

export function RouteImpactNotice({ plan, incidents, nodes, edges }: Props) {
  const plannedEdges = new Set([...plan.baselineEdgeIds, ...(plan.route?.edgeIds ?? [])]);
  const affected = incidents.filter(i => i.status !== 'CLEARED' && !i.dismissedAt && plannedEdges.has(i.edgeId));
  const avoided = affected.filter(i => Boolean(plan.excludedEdges[i.edgeId]));
  const routeChanged = Boolean(plan.route && plan.route.edgeIds.join(',') !== plan.baselineEdgeIds.join(','));
  const names = new Map(nodes.map(n => [n.id, n.name]));
  const pathNames = (ids: string[]) => ids.map(id => names.get(id) ?? id).join(' → ');
  const confirmed = avoided.some(i => i.status === 'CONFIRMED_BLOCKED');

  if (!affected.length && plan.warnings.length) return (
    <section className="surface border-amber-400/40 p-5" aria-label="Before-travel route advisory"><h2 className="font-semibold">Route advisory before travel</h2><ul className="list-disc pl-5 mt-3 space-y-2 text-sm text-amber-200">{plan.warnings.map(w => <li key={w}>{w}</li>)}</ul><p className="text-xs text-slate-400 mt-3">Refresh the reports to inspect the latest incident details.</p></section>
  );
  if (!affected.length) return (
    <section className="surface border-emerald-400/30 p-5 flex items-start gap-3" aria-label="Before-travel route check">
      <ShieldCheck className="w-6 h-6 text-emerald-300 shrink-0" aria-hidden="true" />
      <div><p className="eyebrow text-emerald-300">Checked before you travel</p><h2 className="text-lg font-semibold mt-1">{plan.route ? 'Route clear of known obstructions' : 'No suitable route for this profile'}</h2><p className="text-sm text-slate-400 mt-1">No active community reports on your planned route. This does not verify physical conditions.</p></div>
    </section>
  );

  return (
    <section className={`surface p-5 sm:p-6 space-y-5 ${confirmed ? 'border-red-400/50 bg-red-950/20' : 'border-amber-400/40 bg-amber-950/10'}`} aria-label="Obstruction warning before travel">
      <div className="flex items-start gap-3"><Construction className={`w-7 h-7 shrink-0 ${confirmed ? 'text-red-300' : 'text-amber-300'}`} aria-hidden="true" /><div><p className={`eyebrow ${confirmed ? 'text-red-300' : 'text-amber-300'}`}>Before you travel</p><h2 className="text-xl font-bold mt-1">{confirmed ? 'Obstruction ahead' : 'Reported obstruction ahead'}</h2><p className="text-sm text-slate-300 mt-2">Another traveler submitted a path report on your planned journey. Review the evidence before starting.</p></div></div>
      <div className="space-y-3">{affected.map(incident => {
        const edge = edges.find(e => e.id === incident.edgeId);
        return <div key={incident.id} className="rounded-xl border border-slate-700/70 bg-slate-950/50 p-4"><div className="flex flex-wrap justify-between items-center gap-2"><h3 className="font-semibold">{edge ? `${names.get(edge.from_node) ?? edge.from_node} → ${names.get(edge.to_node) ?? edge.to_node}` : incident.edgeName}</h3><IncidentBadge status={incident.status} disputed={incident.disputed} /></div><p className="text-xs text-slate-400 mt-2">Affected segment: {incident.edgeId.split('').join(' → ')} · {incident.reportsCount} evidence report{incident.reportsCount === 1 ? '' : 's'}</p><p className="text-sm text-slate-300 mt-2">{plan.excludedEdges[incident.edgeId] ?? (incident.status === 'UNVERIFIED' ? 'Unverified report: the current policy warns you but has not excluded this segment.' : 'This segment remains permitted for your selected profile under the current policy.')}</p><Link to={`/incidents/${incident.id}`} className="inline-flex items-center gap-2 mt-3 text-sm text-emerald-300 font-medium">Inspect photo evidence and analysis<ArrowRight className="w-4 h-4" aria-hidden="true" /></Link></div>;
      })}</div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-4"><h3 className="text-sm font-semibold text-slate-300">Normal route</h3><p className="text-2xl font-bold mt-2">{plan.baselineDistanceMeters === null ? 'Unavailable' : `${plan.baselineDistanceMeters} m`}</p><p className="text-sm font-mono text-slate-300 mt-2">{plan.baselineNodeIds.join(' → ')}</p><p className="text-xs leading-relaxed text-slate-400 mt-2">{pathNames(plan.baselineNodeIds)}</p><p className="text-xs text-slate-400 mt-3">Before temporary reports are applied; your accessibility profile still applies.</p></div>
        <div className={`rounded-xl border p-4 ${routeChanged ? 'border-emerald-400/40 bg-emerald-400/5' : 'border-amber-400/30 bg-amber-400/5'}`}><h3 className="text-sm font-semibold">{routeChanged ? 'Recommended alternative' : plan.route ? 'Current route with warning' : 'No suitable alternative'}</h3><p className="text-2xl font-bold mt-2 text-emerald-300">{plan.route ? `${plan.route.distanceMeters} m` : 'NO ROUTE'}</p>{plan.route && <><p className="text-sm font-mono text-slate-300 mt-2">{plan.route.nodeIds.join(' → ')}</p><p className="text-xs leading-relaxed text-slate-400 mt-2">{pathNames(plan.route.nodeIds)}</p></>}</div>
      </div>
      <div className="border-t border-slate-700/70 pt-4"><h3 className="text-sm font-semibold">{routeChanged ? 'Why this alternative?' : 'What happens next?'}</h3><p className="text-sm leading-relaxed text-slate-300 mt-2">{!plan.route ? plan.explanation : avoided.length ? `The normal route contains ${confirmed ? 'an obstruction confirmed for your profile' : 'an unverified obstruction that is avoided as a precaution'}. RouteShield excludes the affected segment and recommends the shortest remaining ${plan.profile === 'STEP_FREE' ? 'step-free' : 'walking'} route in Maple Ward.` : 'No alternative has been selected under the current routing policy. This warning remains visible while the report awaits verification.'}</p>{plan.profile === 'STEP_FREE' && <p className="text-xs text-slate-400 mt-2 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />Stairs and unknown access remain excluded. Step-free is a planning preference, not a safety certification.</p>}</div>
    </section>
  );
}
