<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';

  let recoveryReady = $state(false);
  let checking = $state(true);
  let busy = $state(false);
  let completed = $state(false);
  let newPassword = $state('');
  let error = $state('');
  let message = $state('');

  onMount(() => {
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && event === 'PASSWORD_RECOVERY' && session) recoveryReady = true;
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const recoveryFlow = new URLSearchParams(window.location.search).get('recovery') === '1';
      recoveryReady = recoveryReady || (recoveryFlow && Boolean(data.session));
      checking = false;
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!recoveryReady || newPassword.length < 6) return;
    busy = true;
    error = '';
    message = '';
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      completed = true;
      message = 'Password berhasil diperbarui. Silakan masuk menggunakan password baru.';
      newPassword = '';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Password belum berhasil diperbarui. Minta tautan pemulihan baru.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Reset password — VIXORA Workspace</title>
  <meta name="description" content="Reset password akun VIXORA Workspace." />
</svelte:head>

<main class="auth-shell">
  <a class="auth-brand" href="/" aria-label="Back to VIXORA Workspace">
    <span class="auth-mark">V</span>
    <span><strong>VIXORA</strong><small>AI WORKSPACE</small></span>
  </a>

  <section class="auth-card">
    <div class="auth-eyebrow">ACCOUNT RECOVERY</div>
    <h1>{completed ? 'Password updated.' : 'Choose a new password.'}</h1>
    {#if completed}
      <p class="auth-message success" role="status">{message}</p>
      <a class="auth-submit auth-submit-link" href="/login">Back to sign in →</a>
    {:else if checking}
      <p>Memverifikasi tautan pemulihan akun…</p>
    {:else if recoveryReady}
      <p>Buat password baru untuk akun VIXORA-mu. Gunakan minimal 6 karakter.</p>
      <form onsubmit={submit}>
        <label for="new-password">New password</label>
        <input id="new-password" type="password" autocomplete="new-password" bind:value={newPassword} required minlength="6" placeholder="Minimal 6 karakter" />
        {#if error}<p class="auth-message error" role="alert">{error}</p>{/if}
        <button class="auth-submit" type="submit" disabled={busy || newPassword.length < 6}>{busy ? 'Please wait…' : 'Update password →'}</button>
      </form>
    {:else}
      <p>Tautan pemulihan belum aktif atau sudah kedaluwarsa. Minta tautan baru dari halaman sign in, lalu buka tautan terbaru dari email.</p>
      {#if error}<p class="auth-message error" role="alert">{error}</p>{/if}
      <a class="auth-submit auth-submit-link" href="/login">Back to sign in →</a>
    {/if}
    <div class="auth-note"><span></span> Password dikelola dengan aman oleh Supabase Auth.</div>
  </section>
  <a class="auth-back" href="/login">← Back to sign in</a>
</main>

<style>
  .auth-shell{min-height:100vh;padding:28px 18px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse at 90% 10%,rgba(250,204,21,.22),transparent 28rem),radial-gradient(ellipse at 0 80%,rgba(225,29,46,.07),transparent 25rem),#f8f8f6;color:#171717}
  .auth-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;margin-bottom:25px}
  .auth-mark{width:45px;height:45px;border-radius:13px;background:#e11d2e;color:#fff;display:grid;place-items:center;font:800 27px Manrope;box-shadow:5px 5px 0 #facc15}
  .auth-brand strong,.auth-brand small{display:block}.auth-brand strong{font:800 18px Manrope;letter-spacing:2px}.auth-brand small{font:500 10px 'DM Mono';letter-spacing:2px;color:#777;margin-top:3px}
  .auth-card{width:min(100%,440px);background:#fff;border:1px solid rgba(20,20,20,.1);border-radius:18px;padding:30px;box-shadow:0 18px 55px rgba(0,0,0,.07)}
  .auth-eyebrow{font:500 10px 'DM Mono';letter-spacing:1.3px;color:#e11d2e}
  h1{font:800 32px/1.15 Manrope;letter-spacing:-1.2px;margin:14px 0 10px}
  .auth-card>p{font-size:13px;line-height:1.7;color:#666;margin:0 0 22px}
  form{display:grid;gap:9px}label{font-size:12px;font-weight:700;margin-top:5px}
  input{width:100%;border:1px solid rgba(20,20,20,.16);border-radius:9px;padding:13px;background:#fcfcfb;color:#171717;font:13px 'DM Sans',sans-serif}
  input:focus{outline:2px solid rgba(225,29,46,.22);border-color:#e11d2e}
  .auth-submit{display:block;text-align:center;text-decoration:none;border:0;border-radius:9px;background:#e11d2e;color:#fff;padding:13px;font-weight:700;margin-top:9px;box-shadow:4px 4px 0 #facc15}
  .auth-submit:disabled{opacity:.55;cursor:not-allowed}
  .auth-message{font-size:12px;line-height:1.6;margin:4px 0}.error{color:#b91c1c}.success{color:#166534}
  .auth-note{display:flex;align-items:center;gap:8px;border-top:1px solid #eee;margin-top:22px;padding-top:17px;color:#777;font-size:10px}
  .auth-note span{width:7px;height:7px;border-radius:50%;background:#facc15}
  .auth-back{margin-top:20px;color:#666;font-size:12px;text-decoration:none}.auth-back:hover{color:#e11d2e}
  @media(max-width:480px){.auth-card{padding:23px 19px}h1{font-size:28px}}
</style>
