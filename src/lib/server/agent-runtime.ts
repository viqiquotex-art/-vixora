import { routeTaskToAgent } from './agent-registry.ts';

export type AgentDryRunInput = {
  title: string;
  description?: string | null;
  priority?: string | null;
};

export type AgentDryRunResult = {
  mode: 'local-template-dry-run';
  status: 'preview_ready';
  externalCalls: 0;
  executor: 'none';
  agentId: string;
  agentName: string;
  taskTitle: string;
  summary: string;
  steps: string[];
  deliverables: string[];
  nextAction: string;
  limitations: string[];
  createdAt: string;
};

function deriveTopic(input: AgentDryRunInput): string {
  const source = (input.description?.trim() || input.title).replace(/\s+/g, ' ').trim();
  const cleaned = source
    .replace(/^(tolong|mohon|bantu|buatkan|buat|susun|rancang|siapkan|bikin|coba)\s+/i, '')
    .replace(/^(saya ingin|aku ingin|saya mau|aku mau)\s+/i, '')
    .trim();
  return (cleaned || input.title).slice(0, 180);
}

export function runAgentDryRun(input: AgentDryRunInput): AgentDryRunResult {
  const taskText = [input.title, input.description ?? ''].join('\n').trim();
  const agent = routeTaskToAgent(taskText);
  const topic = deriveTopic(input);
  let summary = '';
  let steps: string[] = [];
  let deliverables: string[] = [];
  let nextAction = '';

  switch (agent.id) {
    case 'content-studio':
      summary = `Content Studio menyiapkan kerangka konten untuk: “${topic}”. Ini draft berbasis template lokal, bukan keluaran model AI.`;
      steps = [
        'Tentukan audiens utama dan satu tujuan konten.',
        'Pilih satu sudut cerita yang spesifik; hindari klaim yang belum diverifikasi.',
        'Tulis hook pembuka, isi ringkas, lalu penutup dengan ajakan yang relevan.',
        'Periksa fakta, hak penggunaan aset, dan kecocokan platform sebelum publikasi.'
      ];
      deliverables = [
        `Hook: “Pernah kepikiran tentang ${topic}? Ini hal yang perlu kamu tahu.”`,
        `Outline: masalah atau konteks → 3 poin inti → kesimpulan praktis → CTA.`,
        'Metadata draft: satu judul yang jelas, deskripsi singkat, dan daftar kata kunci untuk ditinjau.'
      ];
      nextAction = 'Isi fakta dan contoh nyata, lalu review naskah sebelum dipublikasikan.';
      break;
    case 'research-agent':
      summary = `Research Agent menyiapkan rencana riset untuk: “${topic}”. Belum ada penelusuran web atau pengumpulan sumber.`;
      steps = [
        'Ubah tujuan menjadi 2–5 pertanyaan riset yang dapat dijawab.',
        'Cari sumber primer terlebih dahulu, lalu tambahkan sumber sekunder yang kredibel.',
        'Catat penerbit, tanggal, kutipan/parafrasa, dan tautan untuk setiap temuan.',
        'Bandingkan bukti yang sejalan dan bertentangan; tandai hal yang belum pasti.',
        'Rangkum temuan dengan batasan dan rekomendasi yang dapat ditelusuri kembali.'
      ];
      deliverables = [
        'Matriks bukti: pertanyaan | temuan | sumber | tanggal | tingkat keyakinan.',
        'Perbandingan opsi berdasarkan kriteria yang disepakati, bukan asumsi tersembunyi.',
        'Daftar celah data dan klaim yang masih perlu diverifikasi.'
      ];
      nextAction = 'Tentukan cakupan, lokasi/periode, dan kriteria sumber; lakukan riset aktual sebelum mengambil keputusan.';
      break;
    case 'workflow-planner':
      summary = `Workflow Planner menyusun blueprint otomasi untuk: “${topic}”. Workflow belum dibuat atau dijalankan di n8n/CREAO.`;
      steps = [
        'Tentukan trigger, data masuk, hasil akhir, dan pemilik proses.',
        'Validasi input wajib dan bentuk payload sebelum memproses.',
        'Susun node inti: trigger → transform/validasi → aksi → pencatatan hasil.',
        'Rancang autentikasi melalui secret/binding server-side; jangan menanam token di browser atau repo.',
        'Tambahkan jalur error, retry terbatas, idempotensi, dan log tanpa data sensitif.',
        'Uji dengan data dummy, lalu minta persetujuan sebelum mengaktifkan workflow sungguhan.'
      ];
      deliverables = [
        'Blueprint node dan urutan alur untuk ditranslasikan ke n8n.',
        'Daftar field input/output beserta aturan validasinya.',
        'Checklist keamanan, error handling, dan uji penerimaan.'
      ];
      nextAction = 'Cocokkan blueprint dengan workflow n8n/CREAO yang sudah ada; jangan membuat workflow baru sebelum koneksi dan biaya diverifikasi.';
      break;
    default:
      summary = `Strategy & Planner mengubah tujuan “${topic}” menjadi rencana kerja yang dapat diperiksa.`;
      steps = [
        'Nyatakan hasil akhir yang diinginkan dan siapa pengguna hasilnya.',
        'Pecah pekerjaan menjadi langkah berurutan dengan dependensi yang jelas.',
        'Tandai asumsi, risiko, pemilik tindakan, dan keputusan yang membutuhkan persetujuan.',
        'Tetapkan ukuran keberhasilan dan cara memverifikasi hasil.',
        'Tinjau hasil awal lalu revisi berdasarkan bukti, bukan sekadar status selesai.'
      ];
      deliverables = [
        'Rencana kerja berurutan dengan keluaran yang diharapkan pada tiap tahap.',
        'Kriteria penerimaan: hasil sesuai tujuan, dapat diverifikasi, dan tidak melewati izin yang tersedia.',
        `Prioritas awal: ${input.priority === 'high' ? 'tinggi — validasi risiko dan dependensi terlebih dahulu.' : input.priority === 'low' ? 'rendah — jadwalkan setelah pekerjaan prioritas lebih tinggi.' : 'normal — mulai dari langkah terkecil yang dapat diverifikasi.'}`
      ];
      nextAction = 'Konfirmasi ruang lingkup dan kriteria keberhasilan, lalu pilih langkah pertama yang paling kecil risikonya.';
  }

  return {
    mode: 'local-template-dry-run',
    status: 'preview_ready',
    externalCalls: 0,
    executor: 'none',
    agentId: agent.id,
    agentName: agent.name,
    taskTitle: input.title.slice(0, 240),
    summary,
    steps,
    deliverables,
    nextAction,
    limitations: [
      'Tidak memakai model AI/LLM dan tidak mengakses web.',
      'Tidak memanggil CREAO, n8n, atau layanan eksternal.',
      'Tidak mengubah data, menjalankan aksi, atau menyimpan riwayat agent run; hasil ini hanya preview lokal server.'
    ],
    createdAt: new Date().toISOString()
  };
}
