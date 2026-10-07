import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
vi.mock('../context/AuthContext', () => ({useAuth: () => ({isAuthenticated:true,isModerator:false})}));
import { api } from '../lib/api';
import { RealNavigationPage } from '../pages/RealNavigationPage';
import type { RealPlan } from '../types/navigation';
const route = {distanceMeters:400,durationSeconds:240,encodedPolyline:'isolated-fixture',coordinates:[],instructions:['Walk along the path.'],warnings:[],nearbyIncidents:[],avoided:false};
const plan: RealPlan = {status:'OK',baseline:route,recommended:route,candidateCount:1,explanation:'No known reports; coverage incomplete.',accessibility:'Access unverified.',matching:'Approximate matching.',checkedAt:new Date().toISOString(),activeIncidentCount:0};
beforeEach(() => {vi.restoreAllMocks(); vi.spyOn(api,'navigationStatus').mockResolvedValue({configured:true}); vi.spyOn(api,'getRealIncidents').mockResolvedValue({incidents:[]});});
function show() {render(<MemoryRouter><RealNavigationPage /></MemoryRouter>);}
async function requestRoute() {
  fireEvent.change(screen.getByLabelText('Real origin'),{target:{value:'Public origin'}});
  fireEvent.change(screen.getByLabelText('Real destination'),{target:{value:'Public destination'}});
  await waitFor(() => expect(screen.getByRole('button',{name:'Check before travel'})).toBeEnabled());
  fireEvent.click(screen.getByRole('button',{name:'Check before travel'}));
}
describe('Optional real navigation safeguards', () => {
  it('keeps a visible Maple Ward fallback when Google is unconfigured', async () => {
    vi.spyOn(api,'navigationStatus').mockResolvedValue({configured:false}); show();
    expect(await screen.findByText(/Google routing setup is pending/)).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'Open the working Maple Ward demo.'})).toHaveAttribute('href','/plan');
    expect(screen.getByRole('button',{name:'Check before travel'})).toBeDisabled();
  });
  it('shows an honest no-alternative result and preserves the original distance', async () => {
    vi.spyOn(api,'planRealRoute').mockResolvedValue({...plan,status:'NO_VERIFIED_ALTERNATIVE',recommended:null,explanation:'Every returned candidate is affected.'}); show(); await requestRoute();
    expect(await screen.findByText('Every returned candidate is affected.')).toBeInTheDocument();
    expect(screen.getByText('No verified alternative')).toBeInTheDocument(); expect(screen.getByText('400 m')).toBeInTheDocument();
    expect(screen.getByText(/not certified step-free/)).toBeInTheDocument();
  });
  it('does not display an old Google response after the journey changes', async () => {
    let resolve!: (value: RealPlan) => void;
    vi.spyOn(api,'planRealRoute').mockImplementation(() => new Promise(r => {resolve=r;})); show(); await requestRoute();
    await waitFor(() => expect(api.planRealRoute).toHaveBeenCalledOnce());
    fireEvent.change(screen.getByLabelText('Real destination'),{target:{value:'Different destination'}}); resolve(plan);
    await waitFor(() => expect(screen.queryByText('400 m')).not.toBeInTheDocument());
  });
  it('shows provider failure without a fake route', async () => {
    vi.spyOn(api,'planRealRoute').mockRejectedValue(new Error('Google rejected the request.')); show(); await requestRoute();
    expect(await screen.findByRole('alert')).toHaveTextContent('Google rejected the request.');
    expect(screen.queryByText('400 m')).not.toBeInTheDocument();
  });
});
