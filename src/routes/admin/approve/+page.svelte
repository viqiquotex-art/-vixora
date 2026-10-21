<script lang="ts">
  import { page } from '$app/state';

  let busy = $state(false);
  let result = $state('');
  let error = $state('');
  let decided = $state(false);

  const email = $derived(page.url.searchParams.get('email') ?? '');
  const token = $derived(page.url.searchParams.get('token') ?? '');

  async function review(decision: 'approved' | 'rejected') {
    if (busy || decided || !email || !token) return;
    busy = true;
    error = '';
    result = '';
    try {
      const response = await fetch('/api/access-review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, token, decision })
      });
      const body = await response.json() as { message?: string; error?: string; status?: string };
      if (!response.ok) throw new Error(body.message || body.error || 'Permintaan review gagal.');
      result = body.message || (decision === 'approved' ? 'Akun disetujui.' : 'Akun ditolak.');
      decided = true;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Permintaan review gagal.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Review Access — VIXORA Workspace</title>
  <meta name="robots" content="noindex,nofollow" />
</svelte:head>

<main class="review-shell">
  <div class="brand"><span>V</span><div><strong>VIXORA</strong><small>PRIVATE WORKSPACE</small></div></div>
  <section class="review-card">
    <div class="eyebrow">ADMIN ACCESS REVIEW</div>
    <h1>Review account request</h1>
    {#if !email || !token}
      <p class="error">Tautan review tidak lengkap. Buka tautan terbaru dari email admin.</p>
    {:else}
      <p>Permintaan akses dari akun berikut:</p>
      <div class="email">{email}</div>
      <p class="hint">Memilih tindakan akan menghabiskan tautan aman ini. Tautan berlaku selama 48 jam dan hanya dapat digunakan sekali.</p>
      {#if result}<div class="success" role="status">{result}</div>{/if}
      {#if error}<div class="error" role="alert">{error}</div>{/if}
      {#if !decided}
        <div class="actions">
          <button class="approve" disabled={busy} onclick={() => review('approved')}>{busy ? 'Memproses…' : 'Approve access'}</button>
          <button class="reject" disabled={busy} onclick={() => review('rejected')}>Reject</button>
        </div>
      {/if}
    {/if}
    <a href="/login">Kembali ke VIXORA</a>
  </section>
</main>

<style>
  .review-shell{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:radial-gradient(ellipse at 90% 10%,rgba(250,204,21,.2),transparent 28rem),#f8f8f6;color:#171717;font-family:Arial,sans-serif}
  .brand{display:flex;align-items:center;gap:12px;margin-bottom:26px}.brand>span{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:#e11d2e;color:#fff;font-size:27px;font-weight:800;box-shadow:4px 4px 0 #facc15}.brand strong,.brand small{display:block}.brand strong{letter-spacing:2px}.brand small{font-size:10px;color:#777;letter-spacing:2px;margin-top:4px}
  .review-card{width:min(100%,480px);padding:30px;background:#fff;border:1px solid #e5e5e5;border-radius:18px;box-shadow:0 18px 55px #0000000b}.eyebrow{font-size:10px;letter-spacing:1.5px;color:#e11d2e;font-weight:700}h1{font-size:30px;letter-spacing:-1px;margin:14px 0}.review-card p{font-size:13px;line-height:1.7;color:#666}.email{padding:14px;border:1px solid #eee;border-radius:9px;font-weight:700;overflow-wrap:anywhere}.hint{font-size:11px!important}.actions{display:flex;gap:10px;margin:22px 0}.actions button{flex:1;padding:13px;border:0;border-radius:9px;font-weight:700;cursor:pointer}.approve{background:#171717;color:#fff}.reject{background:#f3f3f3;color:#b91c1c}.actions button:disabled{opacity:.5}.success{padding:12px;border-radius:8px;background:#f0fdf4;color:#166534;font-size:13px;margin-top:14px}.error{color:#b91c1c;font-size:13px}.review-card>a{display:inline-block;margin-top:10px;color:#666;font-size:12px;text-decoration:none}
  @media(max-width:480px){.review-card{padding:22px}}
</style>
