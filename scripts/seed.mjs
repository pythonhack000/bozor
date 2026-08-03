// One-off seed script: populates the AccBozor Supabase project with demo
// sellers (as real auth users), listings, and reviews migrated from the
// original static mock data. Run once with:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function attrs(pairs) {
  return pairs.map(([labelRu, labelTj, labelEn, value]) => ({
    label: { ru: labelRu, tj: labelTj, en: labelEn },
    value: { ru: value, tj: value, en: value },
  }));
}

const sellers = [
  { key: "s1", name: "DushanbeGame", online: true, verified: true, rating: 4.9, reviewsCount: 342, salesCount: 1204, responseMinutes: 5, city: "Душанбе" },
  { key: "s2", name: "Khujand_Market", online: false, verified: true, rating: 4.8, reviewsCount: 519, salesCount: 2031, responseMinutes: 15, city: "Худжанд" },
  { key: "s3", name: "ProSeller.tj", online: true, verified: true, rating: 4.7, reviewsCount: 128, salesCount: 476, responseMinutes: 10, city: "Бохтар" },
  { key: "s4", name: "FastTrade.tj", online: true, verified: false, rating: 4.5, reviewsCount: 61, salesCount: 152, responseMinutes: 30, city: "Кӯлоб" },
  { key: "s5", name: "SteamBazar", online: false, verified: true, rating: 4.9, reviewsCount: 891, salesCount: 3410, responseMinutes: 20, city: "Душанбе" },
  { key: "s6", name: "MLBB_Tajikistan", online: true, verified: true, rating: 4.6, reviewsCount: 203, salesCount: 688, responseMinutes: 8, city: "Истаравшан" },
  { key: "s7", name: "TopGamer.tj", online: false, verified: false, rating: 4.3, reviewsCount: 34, salesCount: 79, responseMinutes: 60, city: "Конибодом" },
];

const reviewers = ["Farrukh_98", "Nigora.tj", "Alex_Khj", "Muhammad_TJ"];

const listingsSeed = [
  { key: "l1", categorySlug: "pubg-mobile", title: { ru: "Аккаунт PUBG Mobile Conqueror, 60+ скинов", tj: "Аккаунти PUBG Mobile Conqueror, 60+ скин", en: "PUBG Mobile Conqueror account, 60+ skins" }, description: { ru: "Топовый аккаунт с рангом Conqueror, полная привязка отвязывается перед передачей. Есть редкие наборы M416 Glacier и Mythic-титулы.", tj: "Аккаунти беҳтарин бо рутбаи Conqueror, пайвастҳо пеш аз интиқол ҷудо карда мешаванд. Дастаҳои нодир M416 Glacier ва унвонҳои Mythic мавҷуданд.", en: "Top-tier account with Conqueror rank, all bindings removed before transfer. Includes rare M416 Glacier set and Mythic titles." }, price: 480, oldPrice: 560, sellerKey: "s1", delivery: "manual", server: "Asia", level: 78, attrs: attrs([["Ранг", "Рутба", "Rank", "Conqueror"], ["Уровень", "Сатҳ", "Level", "78"], ["Сервер", "Сервер", "Server", "Asia"], ["Скинов оружия", "Скини яроқ", "Weapon skins", "60+"]]), views: 1420, favorites: 96 },
  { key: "l2", categorySlug: "pubg-mobile", title: { ru: "PUBG Mobile Ace, стартовый аккаунт", tj: "PUBG Mobile Ace, аккаунти оғозӣ", en: "PUBG Mobile Ace, starter account" }, description: { ru: "Хороший аккаунт для начала сезона. Уровень 45, набор базовых скинов, без привязки к соцсетям.", tj: "Аккаунти хуб барои оғози мавсим. Сатҳи 45, дастаи скинҳои асосӣ, бе пайваст ба шабакаҳои иҷтимоӣ.", en: "Good account for starting the season. Level 45, basic skin set, no social media binding." }, price: 95, sellerKey: "s3", delivery: "instant", server: "Asia", level: 45, attrs: attrs([["Ранг", "Рутба", "Rank", "Ace"], ["Уровень", "Сатҳ", "Level", "45"], ["Сервер", "Сервер", "Server", "Asia"]]), views: 340, favorites: 12 },
  { key: "l3", categorySlug: "standoff2", title: { ru: "Standoff 2 аккаунт, 15000+ Elo, редкие ножи", tj: "Аккаунти Standoff 2, 15000+ Elo, кордҳои нодир", en: "Standoff 2 account, 15000+ Elo, rare knives" }, description: { ru: "Высокий рейтинг, инвентарь на 40000+ смн, эксклюзивные ножи и перчатки из ивентов.", tj: "Рейтинги баланд, инвентар ба маблағи 40000+ смн, кордҳо ва дастпӯшакҳои эксклюзивӣ аз ивентҳо.", en: "High rating, inventory worth 40000+ TJS, exclusive event knives and gloves." }, price: 1250, oldPrice: 1400, sellerKey: "s2", delivery: "manual", server: "CIS", level: 61, attrs: attrs([["Elo", "Elo", "Elo", "15200"], ["Ножей", "Корд", "Knives", "6"], ["Сервер", "Сервер", "Server", "CIS"]]), views: 2103, favorites: 210 },
  { key: "l4", categorySlug: "standoff2", title: { ru: "Standoff 2, новый аккаунт без привязки", tj: "Standoff 2, аккаунти нав бе пайваст", en: "Standoff 2, fresh account no binding" }, description: { ru: "Чистый аккаунт для старта, немного золота на балансе, готов к передаче сразу после оплаты.", tj: "Аккаунти тоза барои оғоз, каме тилло дар баланс, барои интиқол пас аз пардохт омода.", en: "Clean account for a fresh start, some gold on balance, ready for instant transfer." }, price: 40, sellerKey: "s4", delivery: "instant", server: "CIS", level: 5, attrs: attrs([["Сервер", "Сервер", "Server", "CIS"], ["Голды", "Тилло", "Gold", "1200"]]), views: 88, favorites: 3 },
  { key: "l5", categorySlug: "free-fire", title: { ru: "Free Fire Grandmaster, эвос пакет", tj: "Free Fire Grandmaster, бастаи Evos", en: "Free Fire Grandmaster, Evos bundle" }, description: { ru: "Аккаунт с редким Evos-скином, много алмазов потрачено на костюмы, высокий винрейт.", tj: "Аккаунт бо скини нодири Evos, алмосҳои зиёд барои костюмҳо сарф шудаанд, винрейти баланд.", en: "Account with rare Evos skin, lots of diamonds spent on outfits, high win rate." }, price: 320, sellerKey: "s1", delivery: "manual", server: "Asia", level: 68, attrs: attrs([["Ранг", "Рутба", "Rank", "Grandmaster"], ["Сервер", "Сервер", "Server", "Asia"]]), views: 654, favorites: 41 },
  { key: "l6", categorySlug: "free-fire", title: { ru: "Free Fire, коллекция скинов на питомцев", tj: "Free Fire, коллексияи скини ҳайвонот", en: "Free Fire, pet skin collection" }, description: { ru: "12 питомцев максимального уровня, редкие скины Falco и Ottero.", tj: "12 ҳайвони дараҷаи баланд, скинҳои нодири Falco ва Ottero.", en: "12 max-level pets, rare Falco and Ottero skins." }, price: 180, sellerKey: "s3", delivery: "manual", server: "Asia", level: 52, attrs: attrs([["Питомцев", "Ҳайвонот", "Pets", "12"]]), views: 231, favorites: 19 },
  { key: "l7", categorySlug: "mobile-legends", title: { ru: "Mobile Legends Mythic Glory, 120 героев", tj: "Mobile Legends Mythic Glory, 120 қаҳрамон", en: "Mobile Legends Mythic Glory, 120 heroes" }, description: { ru: "Все герои открыты, 45 эпических скинов, ранг Mythic Glory 1200 очков.", tj: "Ҳамаи қаҳрамонон кушода, 45 скини эпикӣ, рутбаи Mythic Glory 1200 очко.", en: "All heroes unlocked, 45 epic skins, Mythic Glory rank 1200 points." }, price: 610, oldPrice: 700, sellerKey: "s6", delivery: "manual", server: "SEA", level: 88, attrs: attrs([["Героев", "Қаҳрамон", "Heroes", "120/120"], ["Скинов", "Скин", "Skins", "45"]]), views: 987, favorites: 74 },
  { key: "l8", categorySlug: "mobile-legends", title: { ru: "Mobile Legends, стартовый набор героев", tj: "Mobile Legends, дастаи оғозии қаҳрамонон", en: "Mobile Legends, starter hero pack" }, description: { ru: "25 героев, ранг Epic, аккуратный аккаунт без банов.", tj: "25 қаҳрамон, рутбаи Epic, аккаунти тоза бе бан.", en: "25 heroes, Epic rank, clean account with no bans." }, price: 65, sellerKey: "s6", delivery: "instant", server: "SEA", level: 22, attrs: attrs([["Героев", "Қаҳрамон", "Heroes", "25"]]), views: 145, favorites: 8 },
  { key: "l9", categorySlug: "steam", title: { ru: "Steam аккаунт с CS2 Prime и 30 играми", tj: "Аккаунти Steam бо CS2 Prime ва 30 бозӣ", en: "Steam account with CS2 Prime and 30 games" }, description: { ru: "Библиотека на 30 игр включая CS2 Prime, GTA V, Red Dead Redemption 2. Почта в комплекте.", tj: "Китобхонаи 30 бозӣ, аз ҷумла CS2 Prime, GTA V, Red Dead Redemption 2. Почта дар маҷмӯа.", en: "30-game library including CS2 Prime, GTA V, Red Dead Redemption 2. Email included." }, price: 850, sellerKey: "s5", delivery: "manual", attrs: attrs([["Игр в библиотеке", "Бозӣ дар китобхона", "Games owned", "30"], ["CS2 Prime", "CS2 Prime", "CS2 Prime", "Да"]]), views: 1780, favorites: 132 },
  { key: "l10", categorySlug: "steam", title: { ru: "Steam, только CS2 с 3000 часов", tj: "Steam, танҳо CS2 бо 3000 соат", en: "Steam, CS2 only with 3000 hours" }, description: { ru: "Аккаунт с высоким рейтингом Faceit, много часов в CS2, чистая репутация.", tj: "Аккаунт бо рейтинги баланди Faceit, соатҳои зиёд дар CS2, обрӯи тоза.", en: "Account with high Faceit rating, lots of CS2 hours, clean reputation." }, price: 410, sellerKey: "s5", delivery: "manual", attrs: attrs([["Часов в CS2", "Соат дар CS2", "CS2 hours", "3000+"]]), views: 902, favorites: 55 },
  { key: "l11", categorySlug: "cs2", title: { ru: "CS2 аккаунт с Faceit 8 уровнем, редкие скины", tj: "Аккаунти CS2 бо сатҳи 8-уми Faceit, скинҳои нодир", en: "CS2 account with Faceit level 8, rare skins" }, description: { ru: "Высокий Faceit-рейтинг, инвентарь на 15000+ смн, аккаунт без VAC-банов.", tj: "Рейтинги баланди Faceit, инвентар ба маблағи 15000+ смн, аккаунт бе бани VAC.", en: "High Faceit rating, inventory worth 15000+ TJS, no VAC bans." }, price: 950, oldPrice: 1100, sellerKey: "s2", delivery: "manual", attrs: attrs([["Faceit уровень", "Сатҳи Faceit", "Faceit level", "8"], ["Часов в CS2", "Соат дар CS2", "CS2 hours", "2200+"], ["Инвентарь", "Инвентар", "Inventory", "~15 000 смн"]]), views: 540, favorites: 61 },
  { key: "l12", categorySlug: "cs2", title: { ru: "CS2 Prime аккаунт без банов, MM Silver Elite", tj: "Аккаунти CS2 Prime бе бан, MM Silver Elite", en: "CS2 Prime account, no bans, MM Silver Elite" }, description: { ru: "Чистый Prime-аккаунт для старта, готов к передаче сразу после оплаты.", tj: "Аккаунти тозаи Prime барои оғоз, барои интиқол пас аз пардохт омода.", en: "Clean Prime account for a fresh start, ready for instant transfer." }, price: 180, sellerKey: "s5", delivery: "instant", attrs: attrs([["CS2 Prime", "CS2 Prime", "CS2 Prime", "Да"], ["Ранг MM", "Рутбаи MM", "MM rank", "Silver Elite"]]), views: 1290, favorites: 88 },
  { key: "l13", categorySlug: "genshin-impact", title: { ru: "Genshin Impact AR 58, 12 пятизвёздочных персонажей", tj: "Genshin Impact AR 58, 12 персонажи панҷситора", en: "Genshin Impact AR 58, 12 five-star characters" }, description: { ru: "Прокачанный аккаунт с редкими 5★ персонажами и оружием, много примогемов на балансе.", tj: "Аккаунти пешрафта бо персонажҳои нодири 5★ ва яроқ, примогеми зиёд дар баланс.", en: "Well-developed account with rare 5★ characters and weapons, lots of primogems." }, price: 1100, oldPrice: 1300, sellerKey: "s7", delivery: "manual", attrs: attrs([["Adventure Rank", "Adventure Rank", "Adventure Rank", "58"], ["5★ персонажей", "Персонажи 5★", "5★ characters", "12"], ["Сервер", "Сервер", "Server", "Asia"]]), views: 780, favorites: 47 },
  { key: "l14", categorySlug: "genshin-impact", title: { ru: "Genshin Impact, стартовый аккаунт с Zhongli", tj: "Genshin Impact, аккаунти оғозӣ бо Zhongli", en: "Genshin Impact, starter account with Zhongli" }, description: { ru: "Аккаунт для начала игры с открытым Zhongli, привязка отвязывается перед передачей.", tj: "Аккаунт барои оғози бозӣ бо Zhongli кушода, пайваст пеш аз интиқол ҷудо мешавад.", en: "Fresh account with Zhongli unlocked, bindings removed before transfer." }, price: 220, sellerKey: "s3", delivery: "instant", attrs: attrs([["Adventure Rank", "Adventure Rank", "Adventure Rank", "34"], ["Персонаж", "Персонаж", "Character", "Zhongli"]]), views: 120, favorites: 5 },
  { key: "l15", categorySlug: "roblox", title: { ru: "Roblox аккаунт с редкими Limited-предметами", tj: "Аккаунти Roblox бо ашёи нодири Limited", en: "Roblox account with rare Limited items" }, description: { ru: "Возрастной аккаунт с коллекцией Limited-предметов и Robux на балансе.", tj: "Аккаунти солдор бо коллексияи ашёи Limited ва Robux дар баланс.", en: "Aged account with a Limited item collection and Robux balance." }, price: 260, sellerKey: "s4", delivery: "manual", attrs: attrs([["Robux на балансе", "Robux дар баланс", "Robux balance", "4500"], ["Limited-предметов", "Ашёи Limited", "Limited items", "6"], ["Возраст аккаунта", "Синни аккаунт", "Account age", "3 года"]]), views: 410, favorites: 22 },
  { key: "l16", categorySlug: "roblox", title: { ru: "Roblox, новый аккаунт с Robux", tj: "Roblox, аккаунти нав бо Robux", en: "Roblox, fresh account with Robux" }, description: { ru: "Чистый аккаунт без банов, немного Robux на балансе, готов к передаче сразу.", tj: "Аккаунти тоза бе бан, каме Robux дар баланс, барои интиқол фавран омода.", en: "Clean account with no bans, some Robux on balance, ready for instant transfer." }, price: 60, sellerKey: "s1", delivery: "instant", attrs: attrs([["Robux на балансе", "Robux дар баланс", "Robux balance", "800"]]), views: 290, favorites: 31 },
];

const reviewsSeed = [
  { authorName: "Farrukh_98", rating: 5, text: { ru: "Всё пришло за 5 минут, аккаунт точно как в описании. Продавец на связи!", tj: "Ҳама чиз дар 5 дақиқа омад, аккаунт мисли тавсиф. Фурӯшанда дар алоқа буд!", en: "Everything arrived in 5 minutes, account exactly as described. Seller was responsive!" }, listingKey: "l1" },
  { authorName: "Nigora.tj", rating: 5, text: { ru: "Уже третья покупка у этого продавца, всегда всё честно и быстро.", tj: "Ин харидӣ сеюм аз ин фурӯшанда, ҳамеша ҳама чиз ҳалол ва тез.", en: "Third purchase from this seller, always honest and fast." }, listingKey: "l5" },
  { authorName: "Alex_Khj", rating: 4, text: { ru: "Хороший аккаунт, немного задержалась выдача, но поддержка помогла.", tj: "Аккаунти хуб, интиқол каме дер шуд, аммо дастгирӣ кӯмак кард.", en: "Good account, delivery was a bit delayed but support helped out." }, listingKey: "l3" },
  { authorName: "Muhammad_TJ", rating: 5, text: { ru: "Гарантия реально работает, был спорный момент — деньги вернули за час.", tj: "Кафолат воқеан кор мекунад, як лаҳзаи баҳсталаб буд — пулро дар як соат баргардонданд.", en: "The guarantee genuinely works — had a dispute and got refunded within an hour." }, listingKey: "l9" },
];

async function createSeedUser(email, name) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  return data.user.id;
}

async function main() {
  const sellerIds = {};
  for (const s of sellers) {
    const email = `${s.key}.${s.name.toLowerCase().replace(/[^a-z0-9]/g, "")}@seed.accbozor.local`;
    const id = await createSeedUser(email, s.name);
    sellerIds[s.key] = id;
    const { error } = await supabase
      .from("profiles")
      .update({
        online: s.online,
        verified: s.verified,
        rating: s.rating,
        reviews_count: s.reviewsCount,
        sales_count: s.salesCount,
        response_time_minutes: s.responseMinutes,
        city: s.city,
      })
      .eq("id", id);
    if (error) throw new Error(`update profile ${s.key}: ${error.message}`);
    console.log("seller ready:", s.name);
  }

  const reviewerIds = {};
  for (const name of reviewers) {
    const email = `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}@seed.accbozor.local`;
    const id = await createSeedUser(email, name);
    reviewerIds[name] = id;
    console.log("reviewer ready:", name);
  }

  const listingIds = {};
  for (const l of listingsSeed) {
    const { data, error } = await supabase
      .from("listings")
      .insert({
        category_slug: l.categorySlug,
        seller_id: sellerIds[l.sellerKey],
        title: l.title,
        description: l.description,
        price: l.price,
        old_price: l.oldPrice ?? null,
        delivery: l.delivery,
        server: l.server ?? null,
        level: l.level ?? null,
        attrs: l.attrs,
        views: l.views,
        favorites: l.favorites,
      })
      .select("id")
      .single();
    if (error) throw new Error(`insert listing ${l.key}: ${error.message}`);
    listingIds[l.key] = data.id;
    console.log("listing ready:", l.key);
  }

  for (const r of reviewsSeed) {
    const { error } = await supabase.from("reviews").insert({
      listing_id: listingIds[r.listingKey],
      author_id: reviewerIds[r.authorName],
      rating: r.rating,
      text: r.text,
    });
    if (error) throw new Error(`insert review by ${r.authorName}: ${error.message}`);
    console.log("review ready:", r.authorName);
  }

  console.log("Seed complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
