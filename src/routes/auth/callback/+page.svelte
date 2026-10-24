<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import type { EmailOtpType } from '@supabase/supabase-js';

  let checking = $state(true);
  let success = $state(false);
  let error = $state('');

  onMount(() => {
    let active = true;

    async function finishCallback() {
      try {
        const url = new URL(window.location.href);
        const tokenHash = url.searchParams.get('token_hash');
        const otpType = url.searchParams.get('type');
        const code = url.searchParams.get('code');

        // Supabase email templates can send a token hash directly to the app.
        if (tokenHash && otpType) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType as EmailOtpType
          });
          if (verifyError) throw verifyError;
        } else {
          // The client may already have consumed the PKCE code during initialization.
          let { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;

          if (!session && code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) throw exchangeError;
            ({ data: { session }, error: sessionError } = await supabase.auth.getSession());
            if (sessionError) throw sessionError;
          }

          // In implicit flow, Supabase JS detects the access token from the URL hash.
          if (!session) {
            const { data, error: finalSessionError } = await supabase.auth.getSession();
            if (finalSessionError) throw finalSessionError;
            session = data.session;
          }

          if (!session) {
            throw new Error('Sesi konfirmasi tidak ditemukan. Tautan mungkin kedaluwarsa atau sudah digunakan. Minta tautan konfirmasi terbaru.');
          }
        }

        if (active) success = true;
      } catch (cause) {
        if (active) {
          error = cause instanceof Error
            ? cause.message
            : 'Konfirmasi email gagal. Minta tautan konfirmasi terbaru lalu coba lagi.';
        }
      } finally {
        if (active) checking = false;
      }
    }

    void finishCallback();

    return () => {
      active = false;
    };
  });
</script>

<svelte:head>
  <title>Konfirmasi email — VIXORA Workspace</title>
  <meta name="description" content="Konfirmasi email akun VIXORA Workspace." />
</svelte:head>

<main class="auth-shell">
  <a class="auth-brand" href="/" aria-label="Kembali ke VIXORA Workspace">
    <span class="auth-mark">V</span>
    <span><strong>VIXORA</strong><small>AI WORKSPACE</small></span>
  </a>

  <section class="auth-card" aria-live="polite">
    <div class="auth-eyebrow">ACCOUNT VERIFICATION</div>
    {#if checking}
      <h1>Memverifikasi email…</h1>
      <p>Tunggu sebentar, kami sedang memeriksa tautan konfirmasi akunmu.</p>
      <div class="auth-spinner" aria-hidden="true"></div>
    {:else if success}
      <h1>Email berhasil dikonfirmasi.</h1>
      <p>Konfirmasi email selesai. Selanjutnya masuk ke VIXORA Workspace. Akun baru tetap memerlukan persetujuan admin sebelum workspace dapat dibuka.</p>
      <a class="auth-submit auth-submit-link" href="/login?confirmed=1">Lanjut ke Sign in →</a>
    {:else}
      <h1>Konfirmasi belum berhasil.</h1>
      <p class="auth-message error" role="alert">{error}</p>
      <p>Gunakan tautan terbaru dari email konfirmasi. Jika tautan sudah kedaluwarsa atau pernah dipakai, kembali ke halaman login dan coba lagi sesuai status akun.</p>
      <a class="auth-submit auth-submit-link" href="/login">Kembali ke Sign in →</a>
    {/if}
    <div class="auth-note"><span></span> Autentikasi ditangani oleh Supabase Auth.</div>
  </section>
  <a class="auth-back" href="/">← Kembali ke workspace</a>
</main>

<style>
  .auth-shell{min-height:100vh;padding:28px 18px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(ellipse at 90% 10%,rgba(250,204,21,.22),transparent 28rem),radial-gradient(ellipse at 0 80%,rgba(225,29,46,.07),transparent 25rem),#f8f8f6;color:#171717}
  .auth-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;margin-bottom:25px}
  .auth-mark{width:45px;height:45px;border-radius:13px;background:#e11d2e;color:#fff;display:grid;place-items:center;font:800 27px Manrope;box-shadow:5px 5px 0 #facc15}
  .auth-brand strong,.auth-brand small{display:block}.auth-brand strong{font:800 18px Manrope;letter-spacing:2px}.auth-brand small{font:500 10px 'DM Mono';letter-spacing:2px;color:#777;margin-top:3px}
  .auth-card{width:min(100%,440px);background:#fff;border:1px solid rgba(20,20,20,.1);border-radius:18px;padding:30px;box-shadow:0 18px 55px rgba(0,0,0,.07)}
  .auth-eyebrow{font:500 10px 'DM Mono';letter-spacing:1.3px;color:#e11d2e}
  h1{font:800 30px/1.15 Manrope;letter-spacing:-1px;margin:14px 0 10px}
  .auth-card p{font-size:13px;line-height:1.7;color:#666;margin:0 0 20px}
  .auth-submit{display:block;text-align:center;text-decoration:none;border:0;border-radius:9px;background:#e11d2e;color:#fff;padding:13px;font-weight:700;margin-top:9px;box-shadow:4px 4px 0 #facc15}
  .auth-message.error{color:#b91c1c;overflow-wrap:anywhere}
  .auth-spinner{width:30px;height:30px;border:3px solid #f3d4d7;border-top-color:#e11d2e;border-radius:50%;animation:spin .8s linear infinite;margin:20px auto}
  @keyframes spin{to{transform:rotate(360deg)}}
  .auth-note{display:flex;align-items:center;gap:8px;border-top:1px solid #eee;margin-top:22px;padding-top:17px;color:#777;font-size:10px}
  .auth-note span{width:7px;height:7px;border-radius:50%;background:#facc15}
  .auth-back{margin-top:20px;color:#666;font-size:12px;text-decoration:none}.auth-back:hover{color:#e11d2e}
  @media(max-width:480px){.auth-card{padding:23px 19px}h1{font-size:27px}}
</style>
