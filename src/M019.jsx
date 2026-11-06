import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Landmark, Store, Factory, ShieldCheck, Lock, RefreshCw, Plus, X, ShoppingCart, Wallet, MapPin } from 'lucide-react';

const zones = [
  { id: 'commercial', title: 'COMMERCIAL DISTRICT', subtitle: 'Retail · Hospitality · Logistics', icon: Store },
  { id: 'finance', title: 'MLC FINANCIAL DISTRICT', subtitle: 'Marketplace · Wallet · Business registry', icon: Landmark },
  { id: 'development', title: 'URBAN DEVELOPMENT', subtitle: 'Construction · Energy · Utilities', icon: Factory },
];
const number = (value) => new Intl.NumberFormat('en-US').format(Number(value) || 0);
const categories = [
  ['retail', 'Retail / Store'],
  ['hospitality', 'Hospitality'],
  ['logistics', 'Logistics'],
  ['finance', 'Finance / Services'],
  ['construction', 'Construction'],
  ['utilities', 'Energy / Utilities'],
  ['other', 'Other'],
];

export default function M019City({ supabase, session, walletBalance, setWalletBalance, flash, setPage, onRefresh }) {
  const [sites, setSites] = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [ownsParcel, setOwnsParcel] = useState(false);
  const [listing, setListing] = useState(null);
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [formSite, setFormSite] = useState(null);
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('retail');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Supabase is not configured for this deployment.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const [siteResult, businessResult, claimResult, marketResult] = await Promise.all([
      supabase.from('mars_m019_sites').select('id,parcel_id,zone,name,purpose,x,y,is_open').eq('parcel_id', 'M-019').order('id'),
      supabase.from('mars_m019_businesses').select('id,site_id,name,category,description,status,owner_id').eq('parcel_id', 'M-019').eq('status', 'active'),
      session
        ? supabase.from('world_claims').select('parcel_id').eq('parcel_id', 'M-019').eq('owner_id', session.user.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from('mars_mlc_parcel_market').select('price_mlc,is_listed').eq('parcel_id', 'M-019').maybeSingle(),
    ]);
    if (siteResult.error) setError(siteResult.error.message);
    else setSites(siteResult.data || []);
    if (businessResult.error) setError((current) => current || businessResult.error.message);
    else setBusinesses(businessResult.data || []);
    if (claimResult.error) setError((current) => current || claimResult.error.message);
    setOwnsParcel(Boolean(claimResult.data));
    if (marketResult.error) setError((current) => current || marketResult.error.message);
    else setListing(marketResult.data);
    setLoading(false);
  }, [supabase, session]);

  useEffect(() => { load(); }, [load]);

  const businessBySite = useMemo(
    () => new Map(businesses.map((business) => [business.site_id, business])),
    [businesses],
  );

  const reserveParcel = async () => {
    if (!session) {
      flash('Sign in first to reserve M-019.');
      setPage('Communications');
      return;
    }
    setBusy('reserve');
    const { data, error: rpcError } = await supabase.rpc('mars_mlc_reserve_parcel', { p_parcel_id: 'M-019' });
    setBusy('');
    if (rpcError) {
      flash(rpcError.message);
      return;
    }
    setReservation(data);
    flash('M-019 reserved for 15 minutes. Complete checkout before the hold expires.');
  };

  const grantDemoMlc = async () => {
    if (!session) {
      setPage('Communications');
      flash('Sign in to initialize your demo wallet.');
      return;
    }
    setBusy('wallet');
    const { error: rpcError } = await supabase.rpc('mars_wallet_mlc_grant_starter');
    if (rpcError) {
      flash(rpcError.message);
      setBusy('');
      return;
    }
    const { data, error: ledgerError } = await supabase
      .from('mars_wallet_ledger')
      .select('amount')
      .eq('resource', 'mlc')
      .eq('user_id', session.user.id);
    setBusy('');
    if (ledgerError) {
      flash(ledgerError.message);
      return;
    }
    setWalletBalance((data || []).reduce((total, row) => total + Number(row.amount || 0), 0));
    flash('Demo wallet initialized. MLC has no cash value.');
  };

  const purchaseParcel = async () => {
    if (!session) {
      setPage('Communications');
      flash('Sign in first to continue.');
      return;
    }
    if (!reservation) {
      flash('Reserve M-019 first. The reservation is held for 15 minutes.');
      return;
    }
    const price = Number(listing?.price_mlc || 600);
    if (!window.confirm(`Confirm simulated purchase of M-019 for ${number(price)} MLC? This uses demo MLC only and does not create real-world property rights.`)) return;
    setBusy('purchase');
    const { error: rpcError } = await supabase.rpc('mars_mlc_purchase_parcel', { p_parcel_id: 'M-019' });
    setBusy('');
    if (rpcError) {
      flash(rpcError.message);
      return;
    }
    setReservation(null);
    setOwnsParcel(true);
    flash('M-019 acquired in the LOCAL MARS simulation. You can now register virtual businesses.');
    await load();
    if (onRefresh) await onRefresh();
  };

  const openBusinessForm = (site) => {
    setFormSite(site);
    setBusinessName(site.id === 'M019-A02' ? 'VERDANT OUTPOST' : site.name);
    setCategory(site.zone === 'finance' ? 'finance' : site.zone === 'development' ? 'construction' : 'retail');
    setDescription('');
  };

  const createBusiness = async (event) => {
    event.preventDefault();
    if (!formSite || !session || !ownsParcel) return;
    setBusy('business');
    const { error: insertError } = await supabase.from('mars_m019_businesses').insert({
      site_id: formSite.id,
      parcel_id: 'M-019',
      owner_id: session.user.id,
      name: businessName.trim(),
      category,
      description: description.trim(),
      status: 'active',
      is_public: true,
    });
    setBusy('');
    if (insertError) {
      flash(insertError.message);
      return;
    }
    setFormSite(null);
    flash('Virtual business registered in M-019.');
    await load();
  };

  return (
    <section className="m019">
      <div className="m019-hero">
        <div>
          <small>LOCAL MARS · ECONOMIC ZONE 019</small>
          <h2>M-019 CENTRAL CITY</h2>
          <p>A connected virtual city for commerce, MLC services and owner-built businesses.</p>
          <div className="m019-tags"><span>19 / LAND REGISTRY</span><span>7 / CITY SITES</span><span>3 / DISTRICTS</span></div>
        </div>
        <div className="m019-globe"><div className="m019-orbit"/><div className="m019-planet"/><Building2 size={28}/></div>
      </div>

      <div className="m019-status">
        <div><small>PARCEL STATUS</small><b>{ownsParcel ? 'OWNED BY YOUR ACCOUNT' : listing?.is_listed ? 'AVAILABLE IN MLC MARKET' : 'NOT CURRENTLY LISTED'}</b></div>
        <div><small>AREA SIZE</small><b>4,000 m²</b></div>
        <div><small>LISTING PRICE</small><b>{listing?.is_listed ? number(listing.price_mlc) + ' MLC' : '—'}</b></div>
        <div><small>YOUR MLC BALANCE</small><b>{walletBalance === null ? 'SIGN IN' : number(walletBalance) + ' MLC'}</b></div>
      </div>

      {!ownsParcel && (
        <div className="m019-acquire">
          <div>
            <b><Lock size={15}/> Build access requires M-019 ownership</b>
            <p>Reserve the parcel, then complete the simulated MLC checkout. The current listing is a demo economy, not a real estate sale.</p>
            {reservation?.expires_at && <small className="m019-hold">Reservation held until {new Date(reservation.expires_at).toLocaleString()}</small>}
          </div>
          <div className="m019-actions">
            {session && walletBalance === 0 && <button className="m019-secondary" disabled={busy !== ''} onClick={grantDemoMlc}><Wallet size={14}/>{busy === 'wallet' ? 'Working…' : 'Initialize 1,000 demo MLC'}</button>}
            <button className="m019-secondary" disabled={busy !== '' || !listing?.is_listed} onClick={reserveParcel}><RefreshCw size={14}/>{busy === 'reserve' ? 'Reserving…' : 'Reserve for 15 min'}</button>
            <button className="m019-primary" disabled={busy !== '' || !reservation} onClick={purchaseParcel}><ShoppingCart size={14}/>{busy === 'purchase' ? 'Processing…' : 'Complete purchase'}</button>
          </div>
        </div>
      )}

      {error && <div className="m019-error">Database notice: {error} <button onClick={load}>Retry</button></div>}

      <div className="m019-districts">
        {zones.map((zone) => {
          const Icon = zone.icon;
          const zoneSites = sites.filter((site) => site.zone === zone.id);
          return (
            <section className="m019-zone" key={zone.id}>
              <div className="m019-zone-head"><Icon size={18}/><div><b>{zone.title}</b><small>{zone.subtitle}</small></div><span>{zoneSites.length} SITES</span></div>
              <div className="m019-sites">
                {zoneSites.map((site) => {
                  const business = businessBySite.get(site.id);
                  return (
                    <article className="m019-site" id={"site-" + site.id} key={site.id}>
                      <div className="m019-site-top"><span>{site.id}</span><span className={business ? 'occupied' : site.is_open ? 'available' : 'closed'}>{business ? 'OPERATING' : site.is_open ? 'AVAILABLE' : 'CLOSED'}</span></div>
                      <h3>{site.name}</h3>
                      <p>{site.purpose}</p>
                      {business ? (
                        <div className="m019-business"><ShieldCheck size={14}/><div><b>{business.name}</b><small>{business.category.toUpperCase()} · VIRTUAL BUSINESS</small></div></div>
                      ) : ownsParcel ? (
                        <button className="m019-site-action" onClick={() => openBusinessForm(site)}><Plus size={14}/> Register business</button>
                      ) : (
                        <div className="m019-locked"><Lock size={13}/> Ownership required</div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="m019-map-panel">
        <div className="m019-zone-head"><MapPin size={18}/><div><b>M-019 CITY SITE PLAN</b><small>Seven registered sub-sites inside parcel M-019</small></div></div>
        <div className="m019-map">
          <div className="m019-map-ground"/>
          {sites.map((site) => {
            const business = businessBySite.get(site.id);
            return <button key={site.id} title={site.name} className={'m019-pin ' + (business ? 'occupied' : '')} style={{left: site.x + '%', top: site.y + '%'}} onClick={() => document.getElementById('site-' + site.id)?.scrollIntoView({behavior:'smooth',block:'center'})}><i/>{site.id.replace('M019-','')}</button>;
          })}
          <span className="m019-map-label">M-019 · CENTRAL CITY GRID</span>
        </div>
      </div>

      {loading && <div className="m019-loading">Loading M-019 registry…</div>}
      {!loading && sites.length === 0 && <div className="m019-loading">No city sites are registered yet.</div>}

      {formSite && (
        <div className="m019-modal-backdrop" onClick={() => setFormSite(null)}>
          <form className="m019-modal" onSubmit={createBusiness} onClick={(event) => event.stopPropagation()}>
            <div className="m019-modal-head"><div><small>LANDOWNER WORKSPACE · {formSite.id}</small><h3>Register a virtual business</h3></div><button type="button" onClick={() => setFormSite(null)}><X size={18}/></button></div>
            <label>Business name<input required minLength={2} maxLength={60} value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Enter business name"/></label>
            <label>Business category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label>Description<textarea maxLength={500} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the services in this virtual city"/></label>
            <p>Registration is stored in the LOCAL MARS database and is visible to visitors. It does not establish a real-world company or property right.</p>
            <button className="m019-primary" type="submit" disabled={busy === 'business'}>{busy === 'business' ? 'Saving…' : 'Create virtual business'}</button>
          </form>
        </div>
      )}
    </section>
  );
}
