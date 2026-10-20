/*
  Pengelasan ralat daripada kie.ai, dipisahkan dari geminiService supaya
  boleh diuji tanpa memuatkan Supabase dan pdf.js.

  trySingleModel menukar setiap kegagalan kepada mesej Error dalam DUA bentuk:
    - status HTTP sebenar                   -> "API error 500: ..."
    - HTTP 200 tetapi kod dalam badan JSON  -> "Model error 404: ..."
*/

function kodRalat(err: any): number | null {
  const msg = String(err?.message || "");
  if (!msg.startsWith("API error ") && !msg.startsWith("Model error ")) return null;
  const kod = parseInt(msg.split("error ")[1], 10);
  return Number.isNaN(kod) ? null : kod;
}

/*
  Ralat pelayan sementara yang berbaloi dicuba semula.

  Timeout SENGAJA tidak dianggap sementara: mencuba semula panggilan yang
  sudah menunggu 45-90 saat hanya menggandakan masa menunggu pengguna.
*/
export function isTransientServerError(err: any): boolean {
  const kod = kodRalat(err);
  return kod !== null && kod >= 500 && kod < 600;
}

/*
  Model yang sudah DIBUANG oleh kie.ai. Ia takkan pulih, jadi mencubanya
  pada setiap imbasan cuma membazir masa sebelum model sandaran dicuba.
  Pada 12 Okt 2026 gemini-3-5 dan 3-7 kekal di hadapan senarai selepas mati
  kerana 404 tidak direhatkan — setiap imbasan memanggilnya dahulu.

    - 404 "Invalid model name: HTTP 404"   (3-5, 3-7 pada 12 Okt 2026)
    - 422 "The channel is not supported"   (gemini-3-flash pada 23 Sep 2026)
    - 422 "The model is not supported"     (nama tanpa akhiran -openai)

  422 lain TIDAK dikira: ia boleh bermaksud permintaan itu sendiri ditolak
  (contohnya imej terlalu besar), dan merehatkan model yang sihat kerana satu
  resit yang rosak akan menjejaskan imbasan seterusnya.
*/
export function isDeadModelError(err: any): boolean {
  const kod = kodRalat(err);
  if (kod === 404) return true;
  return kod === 422 && /not supported/i.test(String(err?.message || ""));
}
