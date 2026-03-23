-- Elken Seed: tenant, bot, FAQs, and response templates
-- Idempotent: safe to re-run (ON CONFLICT DO NOTHING)

-- Fixed UUIDs for reproducibility
-- Tenant:  24284717-f4c4-4e26-9174-beeca562f616
-- Bot:     6176aa27-ce33-4dbc-b478-407414f86cac

-- ─── Tenant ──────────────────────────────────────────────────────────────────

INSERT INTO public.tenants (id, name, slug)
VALUES ('24284717-f4c4-4e26-9174-beeca562f616', 'Elken', 'elken')
ON CONFLICT (id) DO NOTHING;

-- ─── Bot ─────────────────────────────────────────────────────────────────────

INSERT INTO public.bots (id, tenant_id, name, feature_flags)
VALUES (
  '6176aa27-ce33-4dbc-b478-407414f86cac',
  '24284717-f4c4-4e26-9174-beeca562f616',
  'Ethan',
  '{"rag": true, "multilingual": true}'
)
ON CONFLICT (id) DO NOTHING;

-- ─── FAQs ─────────────────────────────────────────────────────────────────────
-- 5 questions × 3 languages = 15 rows

INSERT INTO public.faqs (bot_id, question, answer, language) VALUES

-- English
('6176aa27-ce33-4dbc-b478-407414f86cac',
 'How do I become an Elken member?',
 'You can register as an Elken member by contacting your nearest Elken distributor or visiting the official Elken website. A one-time registration fee applies and you will receive a Starter Kit with product samples.',
 'en'),

('6176aa27-ce33-4dbc-b478-407414f86cac',
 'What product categories does Elken carry?',
 'Elken carries five main categories: Beauty (skincare & cosmetics), FMCG (daily essentials), GenQi (energy & wellness devices), Healthfood (supplements & nutrition), and Home Appliances (water purifiers, air purifiers, etc.).',
 'en'),

('6176aa27-ce33-4dbc-b478-407414f86cac',
 'How do I earn and redeem Elken points?',
 'Points (BV/SV) are earned on every qualifying purchase. You can redeem points for product discounts or cash rebates through the Elken member portal or by contacting your upline distributor.',
 'en'),

('6176aa27-ce33-4dbc-b478-407414f86cac',
 'What is Elken's return and exchange policy?',
 'Elken accepts returns within 30 days of purchase for unopened, undamaged products. Please contact your distributor or Elken customer service with your receipt to initiate a return or exchange.',
 'en'),

('6176aa27-ce33-4dbc-b478-407414f86cac',
 'How can I contact Elken customer support?',
 'You can reach Elken customer support at 1800-88-3738 (Malaysia toll-free), via email at cs@elken.com, or through the live chat on the Elken website during business hours (Mon–Fri, 9am–6pm MYT).',
 'en'),

-- Bahasa Malaysia
('6176aa27-ce33-4dbc-b478-407414f86cac',
 'Bagaimana saya boleh menjadi ahli Elken?',
 'Anda boleh mendaftar sebagai ahli Elken dengan menghubungi pengedar Elken berhampiran anda atau melawati laman web rasmi Elken. Bayaran pendaftaran satu kali dikenakan dan anda akan menerima Kit Permulaan dengan sampel produk.',
 'bm'),

('6176aa27-ce33-4dbc-b478-407414f86cac',
 'Apakah kategori produk yang Elken tawarkan?',
 'Elken menawarkan lima kategori utama: Kecantikan (penjagaan kulit & kosmetik), FMCG (keperluan harian), GenQi (peranti tenaga & kesihatan), Makanan Kesihatan (suplemen & nutrisi), dan Peralatan Rumah (penapis air, penapis udara, dll.).',
 'bm'),

('6176aa27-ce33-4dbc-b478-407414f86cac',
 'Bagaimana cara mengumpul dan menebus mata Elken?',
 'Mata (BV/SV) dikumpulkan bagi setiap pembelian yang layak. Anda boleh menebus mata untuk diskaun produk atau rebat tunai melalui portal ahli Elken atau dengan menghubungi pengedar upline anda.',
 'bm'),

('6176aa27-ce33-4dbc-b478-407414f86cac',
 'Apakah polisi pemulangan dan pertukaran Elken?',
 'Elken menerima pemulangan dalam tempoh 30 hari dari tarikh pembelian untuk produk yang tidak dibuka dan tidak rosak. Sila hubungi pengedar anda atau perkhidmatan pelanggan Elken berserta resit untuk memulakan pemulangan atau pertukaran.',
 'bm'),

('6176aa27-ce33-4dbc-b478-407414f86cac',
 'Bagaimana saya boleh menghubungi sokongan pelanggan Elken?',
 'Anda boleh menghubungi sokongan pelanggan Elken di 1800-88-3738 (bebas tol Malaysia), melalui e-mel di cs@elken.com, atau melalui sembang langsung di laman web Elken semasa waktu pejabat (Isnin–Jumaat, 9pg–6ptg WMT).',
 'bm'),

-- Chinese (Simplified)
('6176aa27-ce33-4dbc-b478-407414f86cac',
 '如何成为Elken会员？',
 '您可以联系最近的Elken经销商或访问Elken官方网站进行注册。注册需缴纳一次性费用，您将获得包含产品样品的入门套装。',
 'zh'),

('6176aa27-ce33-4dbc-b478-407414f86cac',
 'Elken有哪些产品类别？',
 'Elken主要提供五大类别：美容（护肤及化妆品）、日用消费品（日常必需品）、GenQi（能量与健康设备）、健康食品（营养补充品）以及家用电器（净水器、空气净化器等）。',
 'zh'),

('6176aa27-ce33-4dbc-b478-407414f86cac',
 '如何积累和兑换Elken积分？',
 '每次合格购物均可获得积分（BV/SV）。您可以通过Elken会员门户或联系您的上线经销商，将积分兑换为产品折扣或现金回扣。',
 'zh'),

('6176aa27-ce33-4dbc-b478-407414f86cac',
 'Elken的退换货政策是什么？',
 'Elken接受购买后30天内未开封、无损坏产品的退货申请。请携带购买收据联系您的经销商或Elken客户服务部门办理退换货手续。',
 'zh'),

('6176aa27-ce33-4dbc-b478-407414f86cac',
 '如何联系Elken客户支持？',
 '您可以拨打1800-88-3738（马来西亚免费电话），发送电子邮件至cs@elken.com，或在办公时间（周一至周五，上午9点至下午6点，马来西亚时间）通过Elken官网在线客服联系我们。',
 'zh')

ON CONFLICT DO NOTHING;

-- ─── Response Templates ────────────────────────────────────────────────────────
-- Intents: browse_product | health_issue | book_session | faq | general
-- 5 intents × 3 languages = 15 rows

INSERT INTO public.response_templates (bot_id, intent_key, language, content) VALUES

-- browse_product
('6176aa27-ce33-4dbc-b478-407414f86cac', 'browse_product', 'en',
 'Here are some Elken products that match your interest! Each one is carefully formulated to support your wellness journey. Would you like more details on any specific item, or shall I recommend based on your needs?'),

('6176aa27-ce33-4dbc-b478-407414f86cac', 'browse_product', 'bm',
 'Berikut adalah beberapa produk Elken yang sesuai dengan minat anda! Setiap produk diformulasikan dengan teliti untuk menyokong perjalanan kesihatan anda. Adakah anda ingin maklumat lanjut tentang mana-mana item, atau boleh saya mengesyorkan berdasarkan keperluan anda?'),

('6176aa27-ce33-4dbc-b478-407414f86cac', 'browse_product', 'zh',
 '以下是一些符合您兴趣的Elken产品！每款产品都经过精心配方，助您开启健康之旅。您是否希望了解某款产品的详情，或者让我根据您的需求为您推荐？'),

-- health_issue
('6176aa27-ce33-4dbc-b478-407414f86cac', 'health_issue', 'en',
 'I understand your health concern. Elken has a range of products that may help support your wellbeing. I''ll share some relevant options — however, please consult a qualified healthcare professional for medical advice.'),

('6176aa27-ce33-4dbc-b478-407414f86cac', 'health_issue', 'bm',
 'Saya memahami kebimbangan kesihatan anda. Elken mempunyai pelbagai produk yang mungkin membantu menyokong kesejahteraan anda. Saya akan kongsikan beberapa pilihan yang berkaitan — walau bagaimanapun, sila rujuk profesional penjagaan kesihatan yang berkelayakan untuk nasihat perubatan.'),

('6176aa27-ce33-4dbc-b478-407414f86cac', 'health_issue', 'zh',
 '我了解您的健康问题。Elken拥有一系列可能有助于支持您健康的产品。我将为您分享一些相关选项——但请务必咨询合格的医疗专业人员以获取医疗建议。'),

-- book_session
('6176aa27-ce33-4dbc-b478-407414f86cac', 'book_session', 'en',
 'I''d love to help you book a session with an Elken wellness consultant! Please share your preferred date, time, and location (or if you prefer an online session) and I''ll connect you with the right person.'),

('6176aa27-ce33-4dbc-b478-407414f86cac', 'book_session', 'bm',
 'Saya ingin membantu anda menempah sesi dengan perunding kesihatan Elken! Sila kongsikan tarikh, masa, dan lokasi pilihan anda (atau jika anda lebih suka sesi dalam talian) dan saya akan menghubungkan anda dengan orang yang sesuai.'),

('6176aa27-ce33-4dbc-b478-407414f86cac', 'book_session', 'zh',
 '我很乐意帮助您预约Elken健康顾问的咨询！请分享您偏好的日期、时间和地点（或者如果您希望进行在线会话），我将为您联系合适的顾问。'),

-- faq
('6176aa27-ce33-4dbc-b478-407414f86cac', 'faq', 'en',
 'Great question! Here''s what I found in our knowledge base:'),

('6176aa27-ce33-4dbc-b478-407414f86cac', 'faq', 'bm',
 'Soalan yang bagus! Berikut adalah apa yang saya temui dalam pangkalan pengetahuan kami:'),

('6176aa27-ce33-4dbc-b478-407414f86cac', 'faq', 'zh',
 '好问题！以下是我在知识库中找到的内容：'),

-- general
('6176aa27-ce33-4dbc-b478-407414f86cac', 'general', 'en',
 'Hi! I''m Ethan, your Elken virtual assistant. I can help you explore our products, answer questions about membership, or connect you with a wellness consultant. What can I help you with today?'),

('6176aa27-ce33-4dbc-b478-407414f86cac', 'general', 'bm',
 'Hai! Saya Ethan, pembantu maya Elken anda. Saya boleh membantu anda meneroka produk kami, menjawab soalan tentang keahlian, atau menghubungkan anda dengan perunding kesihatan. Apa yang boleh saya bantu hari ini?'),

('6176aa27-ce33-4dbc-b478-407414f86cac', 'general', 'zh',
 '你好！我是Ethan，您的Elken虚拟助手。我可以帮助您了解我们的产品、解答会员相关问题，或为您联系健康顾问。今天有什么我可以帮到您的吗？')

ON CONFLICT (bot_id, intent_key, language) DO NOTHING;
