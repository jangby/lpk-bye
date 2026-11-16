import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BriefcaseBusiness, CalendarDays, Check, ChevronDown, HeartHandshake,
  Menu, MessageCircle, ShieldCheck, Users, X
} from 'lucide-react';
import { publicApi } from '../api';

const programs = [
  { icon: 'あ', title: 'Bahasa Jepang Pemula', text: 'Bangun fondasi bahasa Jepang untuk kehidupan dan kebutuhan kerja.', items: 'Hiragana, Katakana, kosakata dasar' },
  { icon: '話', title: 'Persiapan Kerja & Magang', text: 'Latihan percakapan kerja dan wawancara agar lebih percaya diri.', items: 'Percakapan, etika kerja, wawancara' },
  { icon: BriefcaseBusiness, title: 'Pendampingan Administrasi', text: 'Bersama tim kami, persiapan berkas menjadi lebih terarah.', items: 'Berikutnya: konsultasi berkas & program' }
];

const faqs = [
  ['Siapa saja yang dapat mengikuti kelas?', 'Kelas terbuka untuk lulusan SMP/SMA/SMK, fresh graduate, maupun calon pekerja yang memenuhi persyaratan gelombang.'],
  ['Apakah ada persyaratan usia?', 'Persyaratan dapat berbeda berdasarkan program. Informasi lengkap akan dikonfirmasi tim administrasi.'],
  ['Bagaimana cara mengetahui status pendaftaran?', 'Gunakan kode registrasi saat menghubungi admin melalui WhatsApp untuk mengecek status proses Anda.'],
  ['Dokumen apa yang perlu disiapkan?', 'Umumnya identitas diri, data pendidikan, foto, dan dokumen pendukung sesuai informasi pada formulir.'],
  ['Apakah LPK menjamin penempatan kerja?', 'LPK memberikan pembelajaran dan pendampingan. Keputusan penempatan mengikuti ketentuan mitra dan hasil seleksi peserta.'],
  ['Berapa lama pembelajaran kelas?', 'Durasi mengikuti ketentuan setiap gelombang yang tertera pada kartu informasi pendaftaran.']
];

export default function Landing() {
  const [batch, setBatch] = useState(null);
  const [batchState, setBatchState] = useState('loading');
  const [menu, setMenu] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    publicApi('/batch-active')
      .then(({ data }) => { setBatch(data.batch); setBatchState('ready'); })
      .catch(() => setBatchState('empty'));
  }, []);

  const dateText = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenu(false);
  };

  return (
    <div className="overflow-hidden bg-white">
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="container-page flex h-[72px] items-center justify-between">
          <Logo />
          <nav className="hidden items-center gap-7 lg:flex">
            {[['Beranda', 'top'], ['Tentang', 'tentang'], ['Program', 'program'], ['Keunggulan', 'keunggulan'], ['Testimoni', 'testimoni'], ['Kontak', 'kontak']].map(([label, id]) =>
              <button key={id} onClick={() => scrollTo(id)} className="text-sm font-semibold text-slate-600 hover:text-wine-600">{label}</button>
            )}
          </nav>
          <Link to="/pendaftaran" className="btn-primary hidden py-2.5 lg:inline-flex">Daftar Sekarang <ArrowRight size={16}/></Link>
          <button aria-label="Menu" className="p-2 lg:hidden" onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button>
        </div>
        {menu && <div className="border-t border-slate-100 bg-white px-5 py-4 lg:hidden">
          {[['Beranda', 'top'], ['Tentang', 'tentang'], ['Program', 'program'], ['Keunggulan', 'keunggulan'], ['Kontak', 'kontak']].map(([label, id]) =>
            <button key={id} onClick={() => scrollTo(id)} className="block w-full border-b border-slate-100 py-3 text-left font-semibold">{label}</button>
          )}
          <Link to="/pendaftaran" className="btn-primary mt-4 w-full">Daftar Sekarang</Link>
        </div>}
      </header>

      <main id="top">
        <section className="relative bg-[linear-gradient(115deg,#fff8f3_0%,#fff_64%,#f5fafb_100%)]">
          <div className="container-page grid items-center gap-10 py-14 md:min-h-[610px] md:grid-cols-[1.05fr_.95fr] md:py-20">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-wine-100 bg-white px-3 py-1.5 text-xs font-bold text-wine-600">
                <span className="h-2 w-2 rounded-full bg-red-500"/> Pendaftaran Gelombang Dibuka
              </div>
              <h1 className="max-w-[680px] font-display text-4xl font-semibold leading-[1.08] text-navy md:text-[64px]">
                Wujudkan Karier <span className="text-wine-600">Jepang</span> Bersama LPK BYE
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-600">
                Belajar Bahasa Jepang terarah, latihan wawancara kerja, pendampingan administrasi, dan persiapan magang maupun kerja ke Jepang.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/pendaftaran" className="btn-primary px-6">Daftar Sekarang <ArrowRight size={17}/></Link>
                <button onClick={() => scrollTo('program')} className="btn-secondary">Lihat Program</button>
              </div>
              <p className="mt-6 flex items-center gap-2 text-xs text-slate-500"><MessageCircle size={15} className="text-wine-600"/> WhatsApp resmi: 0838-2094-3475</p>
            </div>
            <div className="relative min-h-[400px]">
              <div className="absolute inset-3 rotate-3 rounded-[32px] bg-cyan-100"/>
              <img className="absolute inset-0 h-full w-full rounded-[32px] object-cover shadow-2xl" src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=85" alt="Peserta belajar bersama"/>
              <div className="absolute bottom-6 left-6 right-6 rounded-xl bg-white/95 p-4 shadow-xl backdrop-blur md:left-10 md:right-10">
                <p className="text-xs font-bold text-wine-600">Gelombang terbaru</p>
                <p className="mt-1 font-bold text-navy">{batch?.batch_name || 'Kelas Bahasa Jepang'}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={14}/> Pendaftaran kelas aktif</div>
              </div>
            </div>
          </div>
        </section>

        {batchState !== 'empty' && <section className="container-page -mt-5 relative z-10">
          <div className="grid rounded-2xl border border-slate-100 bg-white p-5 shadow-card md:grid-cols-[2fr_repeat(4,1fr)] md:items-center md:px-7">
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gelombang terpilih</p><p className="mt-1 font-bold text-navy">{batch?.batch_name || 'Memuat gelombang...'}</p></div>
            {[['Periode', batch ? `${dateText(batch.start_date)} — ${dateText(batch.end_date)}` : '-'], ['Kuota', batch ? `${batch.quota} peserta` : '-'], ['Biaya', batch ? new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(batch.training_fee||0)) : '-'], ['Status', batch ? 'Pendaftaran aktif' : '-']].map(([a,b]) =>
              <div key={a} className="mt-4 border-t pt-4 md:mt-0 md:border-l md:border-t-0 md:pl-7 md:pt-0"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{a}</p><p className="mt-1 text-sm font-semibold text-navy">{b}</p></div>
            )}
          </div>
        </section>}

        <section id="tentang" className="container-page grid gap-10 py-20 md:grid-cols-2 md:items-center md:py-28">
          <div className="relative">
            <img className="h-[420px] w-full rounded-2xl object-cover" src="https://images.unsplash.com/photo-1529390079861-591de354faf5?auto=format&fit=crop&w=900&q=85" alt="Suasana belajar peserta"/>
            <div className="absolute bottom-5 left-5 rounded-xl bg-white px-5 py-4 shadow-xl">
              <p className="text-2xl font-bold text-wine-600">Terarah</p><p className="text-xs text-slate-500">Menuju tujuan karier Anda</p>
            </div>
          </div>
          <div>
            <p className="eyebrow">Tentang LPK BYE</p>
            <h2 className="section-title mt-3">Dibimbing Profesional,<br/>Siap Kerja di Jepang</h2>
            <p className="mt-5 leading-7 text-slate-600">LPK BYE membangun pembelajaran bahasa Jepang yang terstruktur, praktis, dan disertai pendampingan untuk membantu peserta mempersiapkan langkah magang maupun kerja.</p>
            {[['Pembaruan kurikulum', 'Materi mengikuti kebutuhan pembelajaran'], ['Pendampingan berkelanjutan', 'Dibantu tim administrasi sepanjang proses'], ['Fokus praktik', 'Sesi percakapan dan simulasi wawancara']].map(([title, text]) =>
              <div key={title} className="mt-5 flex gap-3"><span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-wine-50 text-wine-600"><Check size={13}/></span><div><p className="font-bold text-navy">{title}</p><p className="mt-1 text-sm text-slate-500">{text}</p></div></div>
            )}
          </div>
        </section>

        <section id="program" className="bg-[#fbfaf7] py-20">
          <div className="container-page">
            <div className="max-w-2xl"><p className="eyebrow">Program pilihan</p><h2 className="section-title mt-3">Bekal yang tepat untuk langkahmu.</h2><p className="mt-4 text-slate-500">Pilih jalur pembelajaran sesuai tujuan masa depan Anda.</p></div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {programs.map((program) => {
                const Icon = typeof program.icon === 'string' ? null : program.icon;
                return <article key={program.title} className="card group p-7 transition hover:-translate-y-1">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-wine-50 font-bold text-wine-600">{Icon ? <Icon/> : program.icon}</div>
                  <h3 className="mt-7 text-xl font-bold text-navy">{program.title}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{program.text}</p>
                  <p className="mt-5 border-t border-slate-100 pt-5 text-xs font-semibold text-slate-600">{program.items}</p>
                  <Link to="/pendaftaran" className="mt-6 flex items-center gap-2 text-sm font-bold text-wine-600">Lihat program <ArrowRight size={16}/></Link>
                </article>;
              })}
            </div>
          </div>
        </section>

        <section id="keunggulan" className="container-page py-20">
          <p className="eyebrow">Mengapa memilih LPK BYE</p><h2 className="section-title mt-3">Belajar bahasa,<br/>bukan sekadar menghafal.</h2>
          <div className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {[
              [ShieldCheck,'Kurikulum terstruktur','Materi disusun bertahap dari dasar hingga siap praktik.'],
              [HeartHandshake,'Mentor berpengalaman','Didampingi pengajar yang memahami kebutuhan pembelajar.'],
              [Users,'Kelas interaktif','Percakapan kelompok, praktik, dan sesi diskusi aktif.'],
              [BriefcaseBusiness,'Pendampingan berkelanjutan','Konsultasi proses administrasi sampai peserta siap mengikuti tahapan berikutnya.']
            ].map(([Icon,title,text]) => <div key={title} className="flex gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-wine-50 text-wine-600"><Icon size={19}/></div><div><h3 className="font-bold text-navy">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div></div>)}
          </div>
        </section>

        <section className="container-page py-16 md:py-20" id="pendaftaran">
          <div className="text-center"><p className="eyebrow">Alur sederhana</p><h2 className="section-title mt-3">Perjalananmu dimulai di sini.</h2></div>
          <div className="mt-12 grid gap-8 md:grid-cols-4">
            {[
              ['01','Isi formulir','Lengkapi data diri dan informasi pendukung.'],
              ['02','Kirim berkas','Unggah dokumen sesuai kebutuhan form.'],
              ['03','Verifikasi admin','Tim memeriksa kelengkapan berkas Anda.'],
              ['04','Konfirmasi WhatsApp','Selesaikan konfirmasi melalui WhatsApp.']
            ].map(([n,title,text]) => <div key={n} className="relative"><span className="text-4xl font-bold text-wine-100">{n}</span><h3 className="mt-2 font-bold text-navy">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>)}
          </div>
        </section>

        <section id="testimoni" className="bg-cream py-20">
          <div className="container-page">
            <p className="eyebrow">Testimoni peserta</p><h2 className="section-title mt-3">Belajar dengan lebih percaya diri.</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                ['“Pelajaran terstruktur dan suasana kelas membuat saya tidak takut mencoba berbicara.”','Peserta Bahasa Jepang','Ayu N.'],
                ['“Sesi wawancara sangat membantu saya memahami cara menjawab lebih percaya diri.”','Kelas Persiapan Kerja','Raka P.'],
                ['“Adminnya ramah dan selalu membantu memperjelas setiap tahap administrasi.”','Peserta Gelombang','Dinda S.']
              ].map(([quote,label,name]) => <article key={name} className="rounded-2xl bg-white p-7 shadow-card"><div className="text-wine-600">★★★★★</div><p className="mt-5 min-h-24 leading-7 text-navy">{quote}</p><p className="mt-6 text-sm font-bold text-navy">{name}</p><p className="mt-1 text-xs text-slate-400">{label}</p></article>)}
            </div>
          </div>
        </section>

        <section className="container-page py-20" id="faq">
          <div className="grid gap-10 md:grid-cols-[.7fr_1.3fr]">
            <div><p className="eyebrow">FAQ</p><h2 className="section-title mt-3">Ada yang ingin kamu ketahui?</h2><Link to="/pendaftaran" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-wine-600">Ajukan pertanyaan <ArrowRight size={16}/></Link></div>
            <div className="divide-y divide-slate-100 border-y border-slate-100">
              {faqs.map(([q,a],i) => <div key={q}><button className="flex w-full items-center justify-between py-5 text-left font-bold text-navy" onClick={() => setOpenFaq(openFaq === i ? -1 : i)}>{q}<ChevronDown size={18} className={`transition ${openFaq === i ? 'rotate-180' : ''}`}/></button>{openFaq === i && <p className="pb-5 pr-8 text-sm leading-7 text-slate-500">{a}</p>}</div>)}
            </div>
          </div>
        </section>

        <section className="bg-wine-700" id="kontak">
          <div className="container-page flex flex-col items-start justify-between gap-6 py-12 md:flex-row md:items-center">
            <div className="text-white"><h2 className="font-display text-3xl font-semibold">Siap membuka babak baru?</h2><p className="mt-2 text-sm text-white/70">Daftar sekarang melalui formulir resmi LPK BYE.</p></div>
            <Link to="/pendaftaran" className="rounded-lg bg-white px-6 py-3 text-sm font-bold text-wine-700">Daftar Sekarang <ArrowRight className="ml-2 inline" size={16}/></Link>
          </div>
        </section>
      </main>
      <Footer/>
    </div>
  );
}

export function Logo({ light = false }) {
  return <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-wine-600"><span className="h-2.5 w-4 rounded-t-full border-b border-white/80 bg-[#d8c7c1]"/></span><div className={`font-display text-lg font-bold leading-none ${light ? 'text-white' : 'text-wine-700'}`}><div>LPK BYE</div><div className={`mt-1 text-[7px] font-semibold tracking-[.18em] ${light ? 'text-white/60' : 'text-slate-400'}`}>BANDUNG</div></div></div>;
}

function Footer() {
  return <footer className="bg-[#faf9f6]"><div className="container-page grid gap-8 py-12 md:grid-cols-[1.4fr_1fr_1fr]"><div><Logo/><p className="mt-5 max-w-sm text-xs leading-6 text-slate-500">Lembaga pelatihan bahasa, budaya kerja, dan persiapan karier Jepang yang berbasis di Bandung.</p></div><div><p className="text-xs font-bold text-navy">Navigasi</p><div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500"><span>Beranda</span><span>Program</span><span>Tentang</span><span>Kontak</span></div></div><div><p className="text-xs font-bold text-navy">Hubungi kami</p><p className="mt-4 text-xs text-slate-500">WhatsApp: 0838-2094-3475</p><p className="mt-2 text-xs text-slate-500">Bandung, Jawa Barat</p></div></div><div className="border-t border-slate-100 py-5 text-center text-[11px] text-slate-400">© 2026 LPK BYE · Bandung</div></footer>;
}
