<script lang="ts">
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';

  let mode = $state<'signin' | 'signup' | 'forgot'>('signin');
  let email = $state('');
  let password = $state('');
  let busy = $state(false);
  let message = $state('');
  let error = $state('');

  async function resendApproval() {
    busy = true;
    message = '';
    error = '';
    try {
      const response = await fetch('/api/access-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const result = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(result.message || result.error || 'Permintaan persetujuan gagal.');
      message = result.message || 'Permintaan persetujuan dikirim ke admin.';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Permintaan persetujuan gagal.';
    } finally {
      busy = false;
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    message = '';
    error = '';
    try {
      if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin + '/reset-password?recovery=1'
        });
        if (resetError) throw resetError;
        message = 'Jika email tersebut terdaftar, instruksi pemulihan akan dikirim. Periksa Inbox, Spam, dan Promotions.';
      } else if (mode === 'signin') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        const userEmail = data.user.email?.trim().toLowerCase() ?? '';
        if (userEmail === 'viqiquotex@gmail.com') {
          await goto('/');
          return;
        }
        const accessResponse = await fetch('/api/access-status', {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          cache: 'no-store'
        });
        const access = await accessResponse.json() as { status?: string; error?: string; message?: string };
        if (!accessResponse.ok || access.status !== 'approved') {
          await supabase.auth.signOut();
          if (access.status === 'rejected') {
            message = 'Pendaftaran belum disetujui. Hubungi admin jika kamu merasa ini keliru.';
          } else if (access.status === 'pending') {
            message = 'Akunmu masih menunggu persetujuan admin. Kamu baru bisa masuk setelah disetujui.';
          } else {
            message = 'Akun belum disetujui. Silakan daftar atau ajukan persetujuan terlebih dahulu.';
          }
          return;
        }
        await goto('/');
      } else {
        const { error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin + '/login' }
        });
        if (authError) throw authError;
        const approvalResponse = await fetch('/api/access-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() })
        });
        const approval = await approvalResponse.json() as { status?: string; error?: string; message?: string };
        if (!approvalResponse.ok) {
          message = approval.message || 'Akun dibuat, tetapi email persetujuan admin belum berhasil dikirim. Akses tetap terkunci; hubungi admin.';
        } else if (approval.status === 'approved') {
          message = 'Akun admin terdaftar. Selesaikan konfirmasi email jika diminta, lalu login menggunakan email admin.';
        } else {
          message = 'Pendaftaran diterima dan menunggu persetujuan admin. Setelah email konfirmasi Supabase selesai dan admin menyetujui, kamu bisa login.';
        }
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Autentikasi gagal. Coba lagi.';
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>{mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password'} — VIXORA Workspace</title>
  <meta name="description" content="Secure sign-in for VIXORA Workspace." />
</svelte:head>

<main class="auth-shell">
  <a class="auth-brand" href="/" aria-label="Back to VIXORA Workspace">
    <span class="auth-mark">V</span>
    <span><strong>VIXORA</strong><small>AI WORKSPACE</small></span>
  </a>

  <section class="auth-card">
    <div class="auth-eyebrow">PRIVATE WORKSPACE · ADMIN APPROVAL</div>
    <h1>{mode === 'signin' ? 'Welcome back.' : mode === 'signup' ? 'Create your account.' : 'Reset your password.'}</h1>
    <p>{mode === 'forgot' ? 'Masukkan email akunmu. Kami akan mengirim tautan pemulihan jika alamat tersebut terdaftar dan pengiriman email tersedia.' : 'Daftar untuk meminta akses. Akun baru wajib mendapat persetujuan admin sebelum dapat membuka workspace.'}</p>

    {#if mode !== 'forgot'}
      <div class="auth-switch" role="group" aria-label="Authentication mode">
        <button class:active={mode === 'signin'} type="button" onclick={() => { mode = 'signin'; error = ''; message = ''; }}>Sign in</button>
        <button class:active={mode === 'signup'} type="button" onclick={() => { mode = 'signup'; error = ''; message = ''; }}>Create account</button>
      </div>
    {:else}
      <button class="auth-inline-link back-to-signin" type="button" onclick={() => { mode = 'signin'; error = ''; message = ''; }}>← Kembali ke Sign in</button>
    {/if}

    <form onsubmit={submit}>
      <label for="email">Email</label>
      <input id="email" type="email" autocomplete="email" bind:value={email} required placeholder="you@example.com" />
      {#if mode !== 'forgot'}
        <label for="password">Password</label>
        <input id="password" type="password" autocomplete={mode === 'signin' ? 'current-password' : 'new-password'} bind:value={password} required minlength="6" placeholder="Minimal 6 karakter" />
      {/if}
      {#if mode === 'signin'}
        <button class="auth-inline-link forgot-link" type="button" onclick={() => { mode = 'forgot'; error = ''; message = ''; }}>Lupa password?</button>
        <button class="auth-inline-link" type="button" disabled={busy || !email.trim()} onclick={resendApproval}>Minta / kirim ulang persetujuan admin</button>
      {/if}
      {#if error}<p class="auth-message error" role="alert">{error}</p>{/if}
      {#if message}<p class="auth-message success" role="status">{message}</p>{/if}
      <button class="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in to VIXORA →' : mode === 'signup' ? 'Create account →' : 'Send recovery link →'}</button>
    </form>
    <div class="auth-note"><span></span> Staging environment · credentials handled by Supabase Auth</div>
  </section>
  <a class="auth-back" href="/">← Back to workspace</a>
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
  .auth-switch{display:grid;grid-template-columns:1fr 1fr;gap:5px;background:#f5f5f3;border-radius:9px;padding:4px;margin-bottom:22px}
  .auth-switch button{border:0;background:transparent;border-radius:7px;padding:10px;color:#666;font-size:12px}.auth-switch button.active{background:#fff;color:#e11d2e;box-shadow:0 1px 4px rgba(0,0,0,.08);font-weight:700}
  form{display:grid;gap:9px}label{font-size:12px;font-weight:700;margin-top:5px}
  input{width:100%;border:1px solid rgba(20,20,20,.16);border-radius:9px;padding:13px;background:#fcfcfb;color:#171717;font:13px 'DM Sans',sans-serif}
  input:focus{outline:2px solid rgba(225,29,46,.22);border-color:#e11d2e}
  .auth-submit{border:0;border-radius:9px;background:#e11d2e;color:#fff;padding:13px;font-weight:700;margin-top:9px;box-shadow:4px 4px 0 #facc15}
  .auth-submit:disabled{opacity:.55}
  .auth-message{font-size:12px;line-height:1.6;margin:4px 0}.error{color:#b91c1c}.success{color:#166534}
  .auth-note{display:flex;align-items:center;gap:8px;border-top:1px solid #eee;margin-top:22px;padding-top:17px;color:#777;font-size:10px}
  .auth-note span{width:7px;height:7px;border-radius:50%;background:#facc15}
  .auth-back{margin-top:20px;color:#666;font-size:12px;text-decoration:none}.auth-back:hover{color:#e11d2e}
  .auth-inline-link{border:0;background:transparent;padding:2px 0;color:#c71e2d;font-size:11px;text-align:left;cursor:pointer}.forgot-link{justify-self:end;margin-top:-1px}.back-to-signin{margin:-10px 0 20px}
  @media(max-width:480px){.auth-card{padding:23px 19px}h1{font-size:28px}}
</style>
