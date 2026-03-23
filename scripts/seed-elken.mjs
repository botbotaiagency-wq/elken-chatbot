/**
 * Elken seed script — run once to create tenant, bot, FAQs, and response templates.
 * Usage: node scripts/seed-elken.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
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

async function run() {
  console.log('Seeding Elken data...\n')

  // ── Tenant ──────────────────────────────────────────────────────────────────
  const { error: tenantErr } = await supabase
    .from('tenants')
    .upsert({ id: TENANT_ID, name: 'Elken', slug: 'elken' }, { onConflict: 'id', ignoreDuplicates: true })
  if (tenantErr) throw new Error(`Tenant: ${tenantErr.message}`)
  console.log('✓ Tenant: Elken')

  // ── Bot ─────────────────────────────────────────────────────────────────────
  const { error: botErr } = await supabase
    .from('bots')
    .upsert({
      id: BOT_ID,
      tenant_id: TENANT_ID,
      name: 'Ethan',
      feature_flags: { rag: true, multilingual: true }
    }, { onConflict: 'id', ignoreDuplicates: true })
  if (botErr) throw new Error(`Bot: ${botErr.message}`)
  console.log('✓ Bot: Ethan')

  // ── FAQs ─────────────────────────────────────────────────────────────────────
  const faqs = [
    // English
    { question: 'How do I become an Elken member?',
      answer: 'You can register as an Elken member by contacting your nearest Elken distributor or visiting the official Elken website. A one-time registration fee applies and you will receive a Starter Kit with product samples.',
      language: 'en' },
    { question: 'What product categories does Elken carry?',
      answer: 'Elken carries five main categories: Beauty (skincare & cosmetics), FMCG (daily essentials), GenQi (energy & wellness devices), Healthfood (supplements & nutrition), and Home Appliances (water purifiers, air purifiers, etc.).',
      language: 'en' },
    { question: 'How do I earn and redeem Elken points?',
      answer: 'Points (BV/SV) are earned on every qualifying purchase. You can redeem points for product discounts or cash rebates through the Elken member portal or by contacting your upline distributor.',
      language: 'en' },
    { question: "What is Elken's return and exchange policy?",
      answer: 'Elken accepts returns within 30 days of purchase for unopened, undamaged products. Please contact your distributor or Elken customer service with your receipt to initiate a return or exchange.',
      language: 'en' },
    { question: 'How can I contact Elken customer support?',
      answer: 'You can reach Elken customer support at 1800-88-3738 (Malaysia toll-free), via email at cs@elken.com, or through the live chat on the Elken website during business hours (Mon–Fri, 9am–6pm MYT).',
      language: 'en' },

    // Bahasa Malaysia
    { question: 'Bagaimana saya boleh menjadi ahli Elken?',
      answer: 'Anda boleh mendaftar sebagai ahli Elken dengan menghubungi pengedar Elken berhampiran anda atau melawati laman web rasmi Elken. Bayaran pendaftaran satu kali dikenakan dan anda akan menerima Kit Permulaan dengan sampel produk.',
      language: 'bm' },
    { question: 'Apakah kategori produk yang Elken tawarkan?',
      answer: 'Elken menawarkan lima kategori utama: Kecantikan (penjagaan kulit & kosmetik), FMCG (keperluan harian), GenQi (peranti tenaga & kesihatan), Makanan Kesihatan (suplemen & nutrisi), dan Peralatan Rumah (penapis air, penapis udara, dll.).',
      language: 'bm' },
    { question: 'Bagaimana cara mengumpul dan menebus mata Elken?',
      answer: 'Mata (BV/SV) dikumpulkan bagi setiap pembelian yang layak. Anda boleh menebus mata untuk diskaun produk atau rebat tunai melalui portal ahli Elken atau dengan menghubungi pengedar upline anda.',
      language: 'bm' },
    { question: 'Apakah polisi pemulangan dan pertukaran Elken?',
      answer: 'Elken menerima pemulangan dalam tempoh 30 hari dari tarikh pembelian untuk produk yang tidak dibuka dan tidak rosak. Sila hubungi pengedar anda atau perkhidmatan pelanggan Elken berserta resit untuk memulakan pemulangan atau pertukaran.',
      language: 'bm' },
    { question: 'Bagaimana saya boleh menghubungi sokongan pelanggan Elken?',
      answer: 'Anda boleh menghubungi sokongan pelanggan Elken di 1800-88-3738 (bebas tol Malaysia), melalui e-mel di cs@elken.com, atau melalui sembang langsung di laman web Elken semasa waktu pejabat (Isnin–Jumaat, 9pg–6ptg WMT).',
      language: 'bm' },

    // Chinese (Simplified)
    { question: '如何成为Elken会员？',
      answer: '您可以联系最近的Elken经销商或访问Elken官方网站进行注册。注册需缴纳一次性费用，您将获得包含产品样品的入门套装。',
      language: 'zh' },
    { question: 'Elken有哪些产品类别？',
      answer: 'Elken主要提供五大类别：美容（护肤及化妆品）、日用消费品（日常必需品）、GenQi（能量与健康设备）、健康食品（营养补充品）以及家用电器（净水器、空气净化器等）。',
      language: 'zh' },
    { question: '如何积累和兑换Elken积分？',
      answer: '每次合格购物均可获得积分（BV/SV）。您可以通过Elken会员门户或联系您的上线经销商，将积分兑换为产品折扣或现金回扣。',
      language: 'zh' },
    { question: 'Elken的退换货政策是什么？',
      answer: 'Elken接受购买后30天内未开封、无损坏产品的退货申请。请携带购买收据联系您的经销商或Elken客户服务部门办理退换货手续。',
      language: 'zh' },
    { question: '如何联系Elken客户支持？',
      answer: '您可以拨打1800-88-3738（马来西亚免费电话），发送电子邮件至cs@elken.com，或在办公时间（周一至周五，上午9点至下午6点，马来西亚时间）通过Elken官网在线客服联系我们。',
      language: 'zh' },
  ].map(f => ({ ...f, bot_id: BOT_ID }))

  const { error: faqErr } = await supabase.from('faqs').insert(faqs)
  // Ignore duplicate errors (23505 = unique_violation); faqs has no unique constraint so just warn
  if (faqErr && !faqErr.message.includes('duplicate')) throw new Error(`FAQs: ${faqErr.message}`)
  console.log(`✓ FAQs: ${faqs.length} rows (en/bm/zh × 5 questions)`)

  // ── Response Templates ────────────────────────────────────────────────────────
  const templates = [
    // browse_product
    { intent_key: 'browse_product', language: 'en',
      content: "Here are some Elken products that match your interest! Each one is carefully formulated to support your wellness journey. Would you like more details on any specific item, or shall I recommend based on your needs?" },
    { intent_key: 'browse_product', language: 'bm',
      content: "Berikut adalah beberapa produk Elken yang sesuai dengan minat anda! Setiap produk diformulasikan dengan teliti untuk menyokong perjalanan kesihatan anda. Adakah anda ingin maklumat lanjut tentang mana-mana item, atau boleh saya mengesyorkan berdasarkan keperluan anda?" },
    { intent_key: 'browse_product', language: 'zh',
      content: "以下是一些符合您兴趣的Elken产品！每款产品都经过精心配方，助您开启健康之旅。您是否希望了解某款产品的详情，或者让我根据您的需求为您推荐？" },

    // health_issue
    { intent_key: 'health_issue', language: 'en',
      content: "I understand your health concern. Elken has a range of products that may help support your wellbeing. I'll share some relevant options — however, please consult a qualified healthcare professional for medical advice." },
    { intent_key: 'health_issue', language: 'bm',
      content: "Saya memahami kebimbangan kesihatan anda. Elken mempunyai pelbagai produk yang mungkin membantu menyokong kesejahteraan anda. Saya akan kongsikan beberapa pilihan yang berkaitan — walau bagaimanapun, sila rujuk profesional penjagaan kesihatan yang berkelayakan untuk nasihat perubatan." },
    { intent_key: 'health_issue', language: 'zh',
      content: "我了解您的健康问题。Elken拥有一系列可能有助于支持您健康的产品。我将为您分享一些相关选项——但请务必咨询合格的医疗专业人员以获取医疗建议。" },

    // book_session
    { intent_key: 'book_session', language: 'en',
      content: "I'd love to help you book a session with an Elken wellness consultant! Please share your preferred date, time, and location (or if you prefer an online session) and I'll connect you with the right person." },
    { intent_key: 'book_session', language: 'bm',
      content: "Saya ingin membantu anda menempah sesi dengan perunding kesihatan Elken! Sila kongsikan tarikh, masa, dan lokasi pilihan anda (atau jika anda lebih suka sesi dalam talian) dan saya akan menghubungkan anda dengan orang yang sesuai." },
    { intent_key: 'book_session', language: 'zh',
      content: "我很乐意帮助您预约Elken健康顾问的咨询！请分享您偏好的日期、时间和地点（或者如果您希望进行在线会话），我将为您联系合适的顾问。" },

    // faq
    { intent_key: 'faq', language: 'en',
      content: "Great question! Here's what I found in our knowledge base:" },
    { intent_key: 'faq', language: 'bm',
      content: "Soalan yang bagus! Berikut adalah apa yang saya temui dalam pangkalan pengetahuan kami:" },
    { intent_key: 'faq', language: 'zh',
      content: "好问题！以下是我在知识库中找到的内容：" },

    // general
    { intent_key: 'general', language: 'en',
      content: "Hi! I'm Ethan, your Elken virtual assistant. I can help you explore our products, answer questions about membership, or connect you with a wellness consultant. What can I help you with today?" },
    { intent_key: 'general', language: 'bm',
      content: "Hai! Saya Ethan, pembantu maya Elken anda. Saya boleh membantu anda meneroka produk kami, menjawab soalan tentang keahlian, atau menghubungkan anda dengan perunding kesihatan. Apa yang boleh saya bantu hari ini?" },
    { intent_key: 'general', language: 'zh',
      content: "你好！我是Ethan，您的Elken虚拟助手。我可以帮助您了解我们的产品、解答会员相关问题，或为您联系健康顾问。今天有什么我可以帮到您的吗？" },
  ].map(t => ({ ...t, bot_id: BOT_ID }))

  const { error: tmplErr } = await supabase
    .from('response_templates')
    .upsert(templates, { onConflict: 'bot_id,intent_key,language', ignoreDuplicates: true })
  if (tmplErr) throw new Error(`Templates: ${tmplErr.message}`)
  console.log(`✓ Response templates: ${templates.length} rows (5 intents × en/bm/zh)`)

  console.log('\nSeed complete!')
  console.log(`  Tenant ID: ${TENANT_ID}`)
  console.log(`  Bot ID:    ${BOT_ID}`)
}

run().catch(err => { console.error('\nSeed failed:', err.message); process.exit(1) })
