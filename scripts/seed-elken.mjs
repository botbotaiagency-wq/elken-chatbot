/**
 * Elken seed script — run once to create tenant, bot, FAQs, response templates,
 * and personality config.
 * Usage: node scripts/seed-elken.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Idempotent: safe to run multiple times — upserts with ignoreDuplicates.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Parse .env.local manually (no dotenv dependency needed)
const envPath = resolve(__dirname, '..', '.env.local')
const envLines = readFileSync(envPath, 'utf8').split('\n')
const env = {}
for (const line of envLines) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '')
}

const url = env['NEXT_PUBLIC_SUPABASE_URL']
const key = env['SUPABASE_SERVICE_ROLE_KEY']

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

// ─── Fixed IDs (idempotent) ───────────────────────────────────────────────────
const TENANT_ID = '24284717-f4c4-4e26-9174-beeca562f616'
const BOT_ID    = '6176aa27-ce33-4dbc-b478-407414f86cac'

// ─── Greetings ────────────────────────────────────────────────────────────────
const GREETING_EN = `Hi! 😊 Thank you for contacting Elken. My name is Ethan, I'll be your assistant for today — what can I do for you?
1. Product enquiries
2. GenQi facilities Booking`

const GREETING_BM = `Hai! 😊 Terima kasih kerana menghubungi Elken. Nama saya Ethan, saya akan menjadi pembantu anda untuk hari ini — apakah yang boleh saya bantu?
1. Pertanyaan Produk
2. Tempahan Kemudahan GenQi`

const GREETING_ZH = `您好！😊 感谢您联系 Elken。我是 Ethan，很高兴为您服务 — 请问今天有什么可以帮到您？
1. 一般咨询
2. GenQi 设施预订`

async function run() {
  console.log('Seeding Elken data...\n')

  // ── Tenant ──────────────────────────────────────────────────────────────────
  const { error: tenantErr } = await supabase
    .from('tenants')
    .upsert({ id: TENANT_ID, name: 'Elken', slug: 'elken' }, { onConflict: 'id', ignoreDuplicates: true })
  if (tenantErr) throw new Error(`Tenant: ${tenantErr.message}`)
  console.log('✓ Tenant: Elken')

  // ── Bot ─────────────────────────────────────────────────────────────────────
  // First upsert the bot with core fields (ignoreDuplicates so existing bot is preserved)
  const { error: botErr } = await supabase
    .from('bots')
    .upsert({
      id: BOT_ID,
      tenant_id: TENANT_ID,
      name: 'Ask Ethan Digital',
      feature_flags: { rag: true, multilingual: true, booking_enabled: true }
    }, { onConflict: 'id', ignoreDuplicates: true })
  if (botErr) throw new Error(`Bot: ${botErr.message}`)

  // Update personality fields separately (upsert with ignoreDuplicates won't update on existing row)
  const { error: personalityErr } = await supabase
    .from('bots')
    .update({
      name: 'Ask Ethan Digital',
      feature_flags: { rag: true, multilingual: true, booking_enabled: true },
      greeting_en: GREETING_EN,
      greeting_bm: GREETING_BM,
      greeting_zh: GREETING_ZH,
      tone: 'Friendly',
    })
    .eq('id', BOT_ID)
  if (personalityErr) throw new Error(`Bot personality: ${personalityErr.message}`)
  console.log('✓ Bot: Ask Ethan Digital (personality config applied)')

  // ── FAQs ─────────────────────────────────────────────────────────────────────
  // Note: faqs table has no unique constraint — we insert only on fresh run.
  // Check existing count first to avoid re-inserting on re-run.
  const { count: existingFaqCount } = await supabase
    .from('faqs')
    .select('*', { count: 'exact', head: true })
    .eq('bot_id', BOT_ID)

  const faqs = buildFaqs()

  if ((existingFaqCount ?? 0) === 0) {
    const { error: faqErr } = await supabase.from('faqs').insert(faqs)
    if (faqErr) throw new Error(`FAQs: ${faqErr.message}`)
    console.log(`✓ FAQs: ${faqs.length} rows inserted (en/bm/zh × GenQi + Elken questions)`)
  } else {
    console.log(`✓ FAQs: ${existingFaqCount} existing rows — skipped (already seeded)`)
  }

  // ── Response Templates ────────────────────────────────────────────────────────
  const templates = buildTemplates()

  const { error: tmplErr } = await supabase
    .from('response_templates')
    .upsert(templates, { onConflict: 'bot_id,intent_key,language', ignoreDuplicates: true })
  if (tmplErr) throw new Error(`Templates: ${tmplErr.message}`)
  console.log(`✓ Response templates: ${templates.length} rows (${templates.length / 3} intents × en/bm/zh)`)

  console.log('\nSeed complete!')
  console.log(`  Tenant ID: ${TENANT_ID}`)
  console.log(`  Bot ID:    ${BOT_ID}`)
}

// ─── FAQ content ──────────────────────────────────────────────────────────────
function buildFaqs() {
  const rows = [
    // ── GenQi Old Klang Road (OKR) — English ────────────────────────────────
    {
      language: 'en',
      question: 'Where is GenQi Old Klang Road located and what are the opening hours?',
      answer: 'GenQi Old Klang Road is open Monday to Sunday, 10am to 10pm. We are open on public holidays, except for Chinese New Year, Raya, Deepavali, Christmas, and special occasions (advance notice will be given). You can reach us at 012-2208396 or genqigex@gmail.com.',
    },
    {
      language: 'en',
      question: 'What facilities are available at GenQi Old Klang Road?',
      answer: 'GenQi Old Klang Road offers:\n• Bed (Female): 5 units, 1.5-hour sessions, last booking at 8pm\n• Bed (Male): 2 units, 1.5-hour sessions, last booking at 8pm\n• Inhaler: 8 chairs, 30-minute or 1-hour sessions (last booking 9pm for 30-min, 8:30pm for 1-hour)\n• Meeting Room Small: max 8 pax, with TV and projector (members only)\n• Meeting Room Large: max 50 pax, with TV, projector, and table seating (members only)',
    },
    {
      language: 'en',
      question: 'Are BES devices available at GenQi Old Klang Road?',
      answer: 'Yes! BES devices are available on loan for bed sessions at GenQi Old Klang Road — 5 BES units available. Please let us know when booking if you would like to use a BES device.',
    },
    {
      language: 'en',
      question: 'Who can use the meeting rooms at GenQi Old Klang Road?',
      answer: 'Meeting rooms at GenQi Old Klang Road are for Elken members only. A valid Elken membership ID is required to book. Meeting Room Small fits up to 8 people; Meeting Room Large fits up to 50 people. Both are equipped with TV and projector.',
    },

    // ── GenQi Subang — English ───────────────────────────────────────────────
    {
      language: 'en',
      question: 'Where is GenQi Subang located and what are the opening hours?',
      answer: 'GenQi Subang is open on weekdays (Monday to Friday) from 10am to 6:30pm. We are closed on weekends and public holidays. You can reach us at 0122206215 or genqics@gmail.com.',
    },
    {
      language: 'en',
      question: 'What facilities are available at GenQi Subang?',
      answer: 'GenQi Subang offers:\n• Bed (Female): 5 units, 1.5-hour sessions, last booking at 4:45pm\n• Bed (Male): 2 units, 1.5-hour sessions, last booking at 4:45pm\n• Bed (Unisex): 2 units, 1.5-hour sessions, last booking at 4:45pm (one gender at a time — no gender mixing)\n• Inhaler: 5 chairs, 30-minute or 1-hour sessions (last booking 3:45pm for 30-min, 3:15pm for 1-hour)\n• Note: No meeting rooms at Subang',
    },
    {
      language: 'en',
      question: 'Are BES devices available at GenQi Subang?',
      answer: 'Yes! BES devices are available on loan for bed sessions at GenQi Subang — 4 BES units available. Please indicate when booking if you would like to use a BES device.',
    },
    {
      language: 'en',
      question: 'What are the general rules for visiting GenQi?',
      answer: 'For all GenQi locations:\n• No food or drinks permitted on premises\n• Please arrive 15 minutes early for registration\n• Elken members: booking is confirmed directly; ask about BES device for bed bookings\n• Non-members: a specialist will contact you within 24 hours to complete your booking',
    },

    // ── Elken General — English ──────────────────────────────────────────────
    {
      language: 'en',
      question: 'How do I become an Elken member?',
      answer: 'You can register as an Elken member by contacting your nearest Elken distributor or visiting the official Elken website. A one-time registration fee applies and you will receive a Starter Kit with product samples.',
    },
    {
      language: 'en',
      question: 'What product categories does Elken carry?',
      answer: 'Elken carries five main categories: Beauty (skincare & cosmetics), FMCG (daily essentials), GenQi (energy & wellness devices), Healthfood (supplements & nutrition), and Home Appliances (water purifiers, air purifiers, etc.).',
    },
    {
      language: 'en',
      question: 'How can I contact Elken customer support?',
      answer: 'You can reach Elken customer support at 1800-88-3738 (Malaysia toll-free), via email at cs@elken.com, or through the live chat on the Elken website during business hours (Mon–Fri, 9am–6pm MYT).',
    },
    {
      language: 'en',
      question: "What is Elken's return and exchange policy?",
      answer: 'Elken accepts returns within 30 days of purchase for unopened, undamaged products. Please contact your distributor or Elken customer service with your receipt to initiate a return or exchange.',
    },

    // ── GenQi Old Klang Road (OKR) — Bahasa Malaysia ────────────────────────
    {
      language: 'bm',
      question: 'Di mana GenQi Old Klang Road terletak dan apakah waktu operasinya?',
      answer: 'GenQi Old Klang Road dibuka dari Isnin hingga Ahad, pukul 10 pagi hingga 10 malam. Kami beroperasi pada cuti umum, kecuali Tahun Baru Cina, Hari Raya, Deepavali, Krismas, dan majlis khas (notis awal akan diberikan). Hubungi kami di 012-2208396 atau genqigex@gmail.com.',
    },
    {
      language: 'bm',
      question: 'Kemudahan apa yang tersedia di GenQi Old Klang Road?',
      answer: 'GenQi Old Klang Road menawarkan:\n• Katil (Wanita): 5 unit, sesi 1.5 jam, tempahan terakhir pukul 8 malam\n• Katil (Lelaki): 2 unit, sesi 1.5 jam, tempahan terakhir pukul 8 malam\n• Inhaler: 8 kerusi, sesi 30 minit atau 1 jam (tempahan terakhir: 9 malam untuk 30 minit, 8:30 malam untuk 1 jam)\n• Bilik Mesyuarat Kecil: maks 8 orang, TV dan projektor (ahli sahaja)\n• Bilik Mesyuarat Besar: maks 50 orang, TV, projektor dan tempat duduk (ahli sahaja)',
    },
    {
      language: 'bm',
      question: 'Adakah peranti BES tersedia di GenQi Old Klang Road?',
      answer: 'Ya! Peranti BES tersedia untuk dipinjam bagi sesi katil di GenQi Old Klang Road — terdapat 5 unit BES. Sila maklumkan semasa membuat tempahan jika anda ingin menggunakan peranti BES.',
    },
    {
      language: 'bm',
      question: 'Siapa yang boleh menggunakan bilik mesyuarat di GenQi Old Klang Road?',
      answer: 'Bilik mesyuarat di GenQi Old Klang Road adalah untuk ahli Elken sahaja. Kad keahlian Elken yang sah diperlukan untuk membuat tempahan. Bilik Mesyuarat Kecil memuatkan sehingga 8 orang; Bilik Mesyuarat Besar memuatkan sehingga 50 orang. Kedua-duanya dilengkapi TV dan projektor.',
    },
    {
      language: 'bm',
      question: 'Di mana GenQi Subang terletak dan apakah waktu operasinya?',
      answer: 'GenQi Subang dibuka pada hari bekerja (Isnin hingga Jumaat) dari pukul 10 pagi hingga 6:30 petang. Kami tutup pada hujung minggu dan cuti umum. Hubungi kami di 0122206215 atau genqics@gmail.com.',
    },
    {
      language: 'bm',
      question: 'Kemudahan apa yang tersedia di GenQi Subang?',
      answer: 'GenQi Subang menawarkan:\n• Katil (Wanita): 5 unit, sesi 1.5 jam, tempahan terakhir pukul 4:45 petang\n• Katil (Lelaki): 2 unit, sesi 1.5 jam, tempahan terakhir pukul 4:45 petang\n• Katil (Uniseks): 2 unit, sesi 1.5 jam, tempahan terakhir pukul 4:45 petang (satu jantina sahaja — tiada percampuran jantina)\n• Inhaler: 5 kerusi, sesi 30 minit atau 1 jam (tempahan terakhir: 3:45 petang untuk 30 minit, 3:15 petang untuk 1 jam)\n• Nota: Tiada bilik mesyuarat di Subang',
    },
    {
      language: 'bm',
      question: 'Adakah peranti BES tersedia di GenQi Subang?',
      answer: 'Ya! Peranti BES tersedia untuk dipinjam bagi sesi katil di GenQi Subang — terdapat 4 unit BES. Sila maklumkan semasa membuat tempahan jika anda ingin menggunakan peranti BES.',
    },
    {
      language: 'bm',
      question: 'Apakah peraturan am untuk melawat GenQi?',
      answer: 'Untuk semua lokasi GenQi:\n• Tiada makanan atau minuman dibenarkan di premis\n• Sila hadir 15 minit lebih awal untuk pendaftaran\n• Ahli Elken: tempahan disahkan terus; tanya tentang peranti BES untuk tempahan katil\n• Bukan ahli: pakar kami akan menghubungi anda dalam masa 24 jam untuk melengkapkan tempahan',
    },
    {
      language: 'bm',
      question: 'Bagaimana saya boleh menjadi ahli Elken?',
      answer: 'Anda boleh mendaftar sebagai ahli Elken dengan menghubungi pengedar Elken berhampiran anda atau melawati laman web rasmi Elken. Bayaran pendaftaran satu kali dikenakan dan anda akan menerima Kit Permulaan dengan sampel produk.',
    },
    {
      language: 'bm',
      question: 'Apakah kategori produk yang Elken tawarkan?',
      answer: 'Elken menawarkan lima kategori utama: Kecantikan (penjagaan kulit & kosmetik), FMCG (keperluan harian), GenQi (peranti tenaga & kesihatan), Makanan Kesihatan (suplemen & nutrisi), dan Peralatan Rumah (penapis air, penapis udara, dll.).',
    },
    {
      language: 'bm',
      question: 'Bagaimana saya boleh menghubungi sokongan pelanggan Elken?',
      answer: 'Anda boleh menghubungi sokongan pelanggan Elken di 1800-88-3738 (bebas tol Malaysia), melalui e-mel di cs@elken.com, atau melalui sembang langsung di laman web Elken semasa waktu pejabat (Isnin–Jumaat, 9pg–6ptg WMT).',
    },
    {
      language: 'bm',
      question: 'Apakah polisi pemulangan dan pertukaran Elken?',
      answer: 'Elken menerima pemulangan dalam tempoh 30 hari dari tarikh pembelian untuk produk yang tidak dibuka dan tidak rosak. Sila hubungi pengedar anda atau perkhidmatan pelanggan Elken berserta resit untuk memulakan pemulangan atau pertukaran.',
    },

    // ── GenQi Old Klang Road — Chinese ───────────────────────────────────────
    {
      language: 'zh',
      question: 'GenQi旧巴生路在哪里？营业时间是什么？',
      answer: 'GenQi旧巴生路每天（星期一至星期日）上午10点至晚上10点营业。公共假期照常营业，除农历新年、开斋节、屠妖节、圣诞节及特殊场合外（届时会提前通知）。联系方式：012-2208396 或 genqigex@gmail.com。',
    },
    {
      language: 'zh',
      question: 'GenQi旧巴生路提供哪些设施？',
      answer: 'GenQi旧巴生路提供：\n• 床位（女士）：5个单位，每次1.5小时，最迟预订时间晚上8点\n• 床位（男士）：2个单位，每次1.5小时，最迟预订时间晚上8点\n• 吸氧机：8张椅子，30分钟或1小时疗程（最迟预订：30分钟至晚上9点，1小时至晚上8:30）\n• 小型会议室：最多8人，配备电视和投影仪（仅限会员）\n• 大型会议室：最多50人，配备电视、投影仪及桌椅（仅限会员）',
    },
    {
      language: 'zh',
      question: 'GenQi旧巴生路是否提供BES设备借用？',
      answer: '是的！GenQi旧巴生路提供BES设备借用服务，共有5台可供床位疗程使用。预约时请告知我们是否需要使用BES设备。',
    },
    {
      language: 'zh',
      question: 'GenQi旧巴生路的会议室谁可以使用？',
      answer: 'GenQi旧巴生路的会议室仅限Elken会员使用，预约时需出示有效的Elken会员证。小型会议室最多容纳8人，大型会议室最多容纳50人，两间会议室均配备电视和投影仪。',
    },
    {
      language: 'zh',
      question: 'GenQi梳邦在哪里？营业时间是什么？',
      answer: 'GenQi梳邦仅在工作日（星期一至星期五）上午10点至下午6:30营业。周末及公共假期休息。联系方式：0122206215 或 genqics@gmail.com。',
    },
    {
      language: 'zh',
      question: 'GenQi梳邦提供哪些设施？',
      answer: 'GenQi梳邦提供：\n• 床位（女士）：5个单位，每次1.5小时，最迟预订时间下午4:45\n• 床位（男士）：2个单位，每次1.5小时，最迟预订时间下午4:45\n• 床位（男女通用）：2个单位，每次1.5小时，最迟预订时间下午4:45（每次只限一种性别使用，不可男女混用）\n• 吸氧机：5张椅子，30分钟或1小时疗程（最迟预订：30分钟至下午3:45，1小时至下午3:15）\n• 注意：梳邦没有会议室',
    },
    {
      language: 'zh',
      question: 'GenQi梳邦是否提供BES设备借用？',
      answer: '是的！GenQi梳邦提供BES设备借用服务，共有4台可供床位疗程使用。预约时请告知我们是否需要使用BES设备。',
    },
    {
      language: 'zh',
      question: '访问GenQi有哪些一般规定？',
      answer: '适用于所有GenQi据点：\n• 场内禁止饮食\n• 请提前15分钟到达以完成登记\n• Elken会员：预约直接确认；床位预约时请询问是否需要BES设备\n• 非会员：我们的专员将在24小时内联系您完成预约',
    },
    {
      language: 'zh',
      question: '如何成为Elken会员？',
      answer: '您可以联系最近的Elken经销商或访问Elken官方网站进行注册。注册需缴纳一次性费用，您将获得包含产品样品的入门套装。',
    },
    {
      language: 'zh',
      question: 'Elken有哪些产品类别？',
      answer: 'Elken主要提供五大类别：美容（护肤及化妆品）、日用消费品（日常必需品）、GenQi（能量与健康设备）、健康食品（营养补充品）以及家用电器（净水器、空气净化器等）。',
    },
    {
      language: 'zh',
      question: '如何联系Elken客户支持？',
      answer: '您可以拨打1800-88-3738（马来西亚免费电话），发送电子邮件至cs@elken.com，或在办公时间（周一至周五，上午9点至下午6点，马来西亚时间）通过Elken官网在线客服联系我们。',
    },
    {
      language: 'zh',
      question: 'Elken的退换货政策是什么？',
      answer: 'Elken接受购买后30天内未开封、无损坏产品的退货申请。请携带购买收据联系您的经销商或Elken客户服务部门办理退换货手续。',
    },
  ]

  return rows.map(f => ({ ...f, bot_id: BOT_ID }))
}

// ─── Response Template content ────────────────────────────────────────────────
function buildTemplates() {
  const templates = [
    // ── slot_full ────────────────────────────────────────────────────────────
    {
      intent_key: 'slot_full',
      language: 'en',
      content: "Oops! We're sorry, the selected time slot is fully booked. Next available time slots are <time>. Would you like me to proceed for you? Or, do you have another preferred date and time? 😊",
    },
    {
      intent_key: 'slot_full',
      language: 'bm',
      content: 'Alamak! Maaf, slot masa yang dipilih telah penuh. Slot masa yang tersedia seterusnya ialah <time>. Adakah anda ingin saya teruskan? Atau, adakah anda mempunyai tarikh dan masa pilihan lain? 😊',
    },
    {
      intent_key: 'slot_full',
      language: 'zh',
      content: '抱歉！您选择的时间段已被预订。下一个可用时间段是 <time>。您希望我为您预订吗？或者您有其他preferred的日期和时间？😊',
    },

    // ── booking_confirmed_member ──────────────────────────────────────────────
    {
      intent_key: 'booking_confirmed_member',
      language: 'en',
      content: 'All set <name> 😊 Your booking is confirmed with details <facility> <date & time> <with BES / no BES>. No food and drinks are permitted in our premises. Please present 15 min earlier before your booking for registration purpose. See you then!',
    },
    {
      intent_key: 'booking_confirmed_member',
      language: 'bm',
      content: 'Siap <name> 😊 Tempahan anda telah disahkan dengan butiran <facility> <date & time> <with BES / no BES>. Tiada makanan dan minuman dibenarkan di premis kami. Sila hadir 15 minit lebih awal untuk tujuan pendaftaran. Jumpa nanti!',
    },
    {
      intent_key: 'booking_confirmed_member',
      language: 'zh',
      content: '好的 <name> 😊 您的预订已确认，详情为 <facility> <date & time> <with BES / no BES>。请勿在场内饮食。请提前15分钟到达进行登记。到时见！',
    },

    // ── booking_confirmed_nonmember ───────────────────────────────────────────
    {
      intent_key: 'booking_confirmed_nonmember',
      language: 'en',
      content: 'All set <name> 😊 Our specialist will contact you for further details within the next 24 hours.',
    },
    {
      intent_key: 'booking_confirmed_nonmember',
      language: 'bm',
      content: 'Siap <name> 😊 Pakar kami akan menghubungi anda untuk maklumat lanjut dalam masa 24 jam.',
    },
    {
      intent_key: 'booking_confirmed_nonmember',
      language: 'zh',
      content: '好的 <name> 😊 我们的专员将在24小时内联系您以了解更多详情。',
    },

    // ── reminder_24h ─────────────────────────────────────────────────────────
    {
      intent_key: 'reminder_24h',
      language: 'en',
      content: 'Hi <name> 😊 Just a friendly reminder — you have a booking tomorrow at <facility> <time>. Please present 15 min earlier for registration. No food and drinks permitted on premises. See you soon!',
    },
    {
      intent_key: 'reminder_24h',
      language: 'bm',
      content: 'Hai <name> 😊 Peringatan mesra — anda mempunyai tempahan esok di <facility> <time>. Sila hadir 15 minit lebih awal untuk pendaftaran. Tiada makanan dan minuman di premis. Jumpa soon!',
    },
    {
      intent_key: 'reminder_24h',
      language: 'zh',
      content: '你好 <name> 😊 温馨提醒 — 您明天在 <facility> <time> 有一个预约。请提前15分钟到达登记。场内禁止饮食。明天见！',
    },

    // ── post_survey ───────────────────────────────────────────────────────────
    {
      intent_key: 'post_survey',
      language: 'en',
      content: "Hi <name> 😊 Thank you for visiting GenQi today! We hope you had a great experience. Could you take a moment to rate your session? Reply with a number 1-5 (5 being excellent) and any comments you'd like to share.",
    },
    {
      intent_key: 'post_survey',
      language: 'bm',
      content: 'Hai <name> 😊 Terima kasih kerana melawati GenQi hari ini! Kami harap anda menikmati pengalaman anda. Boleh anda luangkan masa untuk menilai sesi anda? Balas dengan nombor 1-5 (5 cemerlang) dan sebarang komen.',
    },
    {
      intent_key: 'post_survey',
      language: 'zh',
      content: '你好 <name> 😊 感谢您今天光临GenQi！希望您有愉快的体验。请问您能花一点时间评价您的疗程吗？请回复1-5分（5分为优秀）及任何意见。',
    },

    // ── no_product_found ──────────────────────────────────────────────────────
    {
      intent_key: 'no_product_found',
      language: 'en',
      content: "I'm sorry, I couldn't find a specific product match for your query. Here are some of our popular wellness products that might help. Would you like more details on any of these?",
    },
    {
      intent_key: 'no_product_found',
      language: 'bm',
      content: 'Maaf, saya tidak dapat mencari produk yang sepadan dengan pertanyaan anda. Berikut adalah beberapa produk kesihatan popular kami yang mungkin membantu. Adakah anda ingin maklumat lanjut?',
    },
    {
      intent_key: 'no_product_found',
      language: 'zh',
      content: '抱歉，我找不到与您查询相符的具体产品。以下是一些可能对您有帮助的热门健康产品。您需要了解更多详情吗？',
    },

    // ── browse_product ────────────────────────────────────────────────────────
    {
      intent_key: 'browse_product',
      language: 'en',
      content: "Here are some Elken products that match your interest! Each one is carefully formulated to support your wellness journey. Would you like more details on any specific item, or shall I recommend based on your needs?",
    },
    {
      intent_key: 'browse_product',
      language: 'bm',
      content: 'Berikut adalah beberapa produk Elken yang sesuai dengan minat anda! Setiap produk diformulasikan dengan teliti untuk menyokong perjalanan kesihatan anda. Adakah anda ingin maklumat lanjut tentang mana-mana item, atau boleh saya mengesyorkan berdasarkan keperluan anda?',
    },
    {
      intent_key: 'browse_product',
      language: 'zh',
      content: '以下是一些符合您兴趣的Elken产品！每款产品都经过精心配方，助您开启健康之旅。您是否希望了解某款产品的详情，或者让我根据您的需求为您推荐？',
    },

    // ── health_issue ──────────────────────────────────────────────────────────
    {
      intent_key: 'health_issue',
      language: 'en',
      content: "I understand your health concern. Elken has a range of products that may help support your wellbeing. I'll share some relevant options — however, please consult a qualified healthcare professional for medical advice.",
    },
    {
      intent_key: 'health_issue',
      language: 'bm',
      content: 'Saya memahami kebimbangan kesihatan anda. Elken mempunyai pelbagai produk yang mungkin membantu menyokong kesejahteraan anda. Saya akan kongsikan beberapa pilihan yang berkaitan — walau bagaimanapun, sila rujuk profesional penjagaan kesihatan yang berkelayakan untuk nasihat perubatan.',
    },
    {
      intent_key: 'health_issue',
      language: 'zh',
      content: '我了解您的健康问题。Elken拥有一系列可能有助于支持您健康的产品。我将为您分享一些相关选项——但请务必咨询合格的医疗专业人员以获取医疗建议。',
    },

    // ── book_session ──────────────────────────────────────────────────────────
    {
      intent_key: 'book_session',
      language: 'en',
      content: "I'd love to help you book a GenQi session! Please let me know your preferred location (Old Klang Road or Subang), facility type, and your preferred date and time.",
    },
    {
      intent_key: 'book_session',
      language: 'bm',
      content: 'Saya ingin membantu anda menempah sesi GenQi! Sila beritahu saya lokasi pilihan anda (Old Klang Road atau Subang), jenis kemudahan, serta tarikh dan masa yang anda kehendaki.',
    },
    {
      intent_key: 'book_session',
      language: 'zh',
      content: '我很乐意帮您预约GenQi疗程！请告诉我您偏好的地点（旧巴生路或梳邦）、设施类型，以及您希望的日期和时间。',
    },

    // ── faq ───────────────────────────────────────────────────────────────────
    {
      intent_key: 'faq',
      language: 'en',
      content: 'Great question! Here\'s what I found in our knowledge base:',
    },
    {
      intent_key: 'faq',
      language: 'bm',
      content: 'Soalan yang bagus! Berikut adalah apa yang saya temui dalam pangkalan pengetahuan kami:',
    },
    {
      intent_key: 'faq',
      language: 'zh',
      content: '好问题！以下是我在知识库中找到的内容：',
    },

    // ── general ───────────────────────────────────────────────────────────────
    {
      intent_key: 'general',
      language: 'en',
      content: "Hi! I'm Ethan, your Elken virtual assistant. I can help you explore our products, answer questions about membership, or connect you with a wellness consultant. What can I help you with today?",
    },
    {
      intent_key: 'general',
      language: 'bm',
      content: 'Hai! Saya Ethan, pembantu maya Elken anda. Saya boleh membantu anda meneroka produk kami, menjawab soalan tentang keahlian, atau menghubungkan anda dengan perunding kesihatan. Apa yang boleh saya bantu hari ini?',
    },
    {
      intent_key: 'general',
      language: 'zh',
      content: '你好！我是Ethan，您的Elken虚拟助手。我可以帮助您了解我们的产品、解答会员相关问题，或为您联系健康顾问。今天有什么我可以帮到您的吗？',
    },
  ]

  return templates.map(t => ({ ...t, bot_id: BOT_ID }))
}

run().catch(err => { console.error('\nSeed failed:', err.message); process.exit(1) })
