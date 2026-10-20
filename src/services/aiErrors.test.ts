// Ujian ringkas tanpa framework — jalankan dengan: npx tsx src/services/aiErrors.test.ts
import { isTransientServerError, isDeadModelError } from "./aiErrors";

let pass = 0;
let fail = 0;

function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "  ok  " : " GAGAL"} ${name}`);
  if (!ok) console.log(`        dapat ${JSON.stringify(got)}, jangka ${JSON.stringify(want)}`);
  ok ? pass++ : fail++;
}

const ralat = (msg: string) => new Error(msg);

console.log("\nisDeadModelError — model yang dibuang kie.ai:");
check("404 dalam badan JSON (3-5/3-7, 12 Okt)", isDeadModelError(ralat("Model error 404: Invalid model name: HTTP 404")), true);
check("404 sebagai status HTTP", isDeadModelError(ralat("API error 404: Not Found")), true);
check("422 channel not supported", isDeadModelError(ralat("Model error 422: The channel is not supported")), true);
check("422 model not supported", isDeadModelError(ralat("Model error 422: The model is not supported")), true);
check("422 lain — permintaan ditolak, model sihat", isDeadModelError(ralat("Model error 422: image too large")), false);
check("500 bukan model mati", isDeadModelError(ralat("Model error 500: internal error")), false);
check("timeout bukan model mati", isDeadModelError(ralat("Timeout: Model x tidak bertindak balas dalam 45s")), false);
check("ralat rangkaian bukan model mati", isDeadModelError(ralat("Failed to fetch")), false);

console.log("\nisTransientServerError — kekal seperti dahulu:");
check("500 dalam badan JSON", isTransientServerError(ralat("Model error 500: internal error")), true);
check("524 sebagai status HTTP", isTransientServerError(ralat("API error 524: timeout")), true);
check("404 bukan sementara", isTransientServerError(ralat("Model error 404: Invalid model name")), false);
check("timeout bukan sementara", isTransientServerError(ralat("Timeout: Model x")), false);

console.log(`\n${pass} lulus, ${fail} gagal\n`);
if (fail > 0) process.exit(1);
