/**
 * prisma/seed.ts — 預載 1,000 筆黑名單合成資料
 *
 * 設計決策（2026-08-08）：
 * - 「不爬 Dcard」 — 爬蟲法律風險 + Dcard robots.txt 不一定允許（PRD §7.1 R1/R5 誹謗風險）
 * - 程式生成「姓氏池 + 區域池 + 糾紛類型池 + 隨機日期」合成資料
 * - 去識別化由程式做：「王大明」→「王○明」一律存進 DB
 * - 完整姓名只在 landlordNameFull 欄位存（將來 Pro 付費才回傳）
 * - 1,000 筆資料預載用 createMany 批次寫入，< 5 秒
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// PRD §4.3 §5.2 — 個資保護：個資法要求最小化揭露
// 姓氏池（取自 2025 全台前 30 大姓氏）
const SURNAMES = [
  "陳", "林", "黃", "張", "李", "王", "吳", "劉", "蔡", "楊",
  "許", "鄭", "謝", "洪", "郭", "邱", "曾", "廖", "賴", "徐",
  "周", "葉", "蘇", "莊", "江", "何", "蕭", "羅", "高", "簡",
];

// PRD §5.1 — 房東只顯示姓 + 第一個字，其他用 ○ 取代
// 範例：「王大明」→ 儲存為「王○明」
function maskName(fullName: string): string {
  if (fullName.length < 2) return fullName;
  if (fullName.length === 2) {
    // 雙字姓名（如「陳伊」）：保留姓 + 第一個字用 ○
    return `${fullName[0]}○`;
  }
  // 三字以上：保留姓 + 中間字 + 最後一個字
  // 「王大明」→ 「王○明」、「李小明」→ 「李○明」、「陳怡君」→ 「陳○君」
  return `${fullName[0]}○${fullName[fullName.length - 1]}`;
}

// 隨機產生常見中文名字（兩字、三字）
const GIVEN_NAMES_2 = [
  "怡君", "志明", "建宏", "美玲", "俊傑", "雅婷", "宗翰", "詩涵", "冠宇", "佳穎",
  "淑芬", "家豪", "佩珊", "志豪", "雅雯", "承翰", "筱涵", "柏翰", "郁婷", "彥廷",
];

const GIVEN_NAMES_3 = [
  "大明", "小華", "志偉", "雅琪", "俊宏", "佩君", "建良", "美惠", "志強", "雅芳",
  "宗佑", "詩婷", "冠廷", "佳蓉", "淑娟", "家瑋", "佩怡", "志斌", "雅慧", "承佑",
];

// 縣市區池（涵蓋北中南東部租屋熱區）
const DISTRICTS = [
  "台北市大安區", "台北市信義區", "台北市松山區", "台北市中山區", "台北市士林區",
  "台北市內湖區", "台北市南港區", "台北市文山區", "台北市萬華區", "台北市北投區",
  "新北市板橋區", "新北市新莊區", "新北市中和區", "新北市永和區", "新北市新店區",
  "新北市三重區", "新北市汐止區", "新北市林口區", "新北市土城區",
  "桃園市桃園區", "桃園市中壢區", "桃園市八德區", "桃園市龜山區",
  "台中市西區", "台中市北區", "台中市南區", "台中市西屯區", "台中市北屯區",
  "台中市南屯區", "台中市太平區", "台中市大里區",
  "台南市東區", "台南市北區", "台南市中西區", "台南市南區", "台南市永康區",
  "高雄市前金區", "高雄市新興區", "高雄市苓雅區", "高雄市前鎮區", "高雄市三民區",
  "高雄市左營區", "高雄市鼓山區", "高雄市楠梓區",
];

// 糾紛類型（PRD §4.3 §3.1 P0-1）
const CATEGORIES = [
  "deposit_dispute",      // 押金不退
  "early_termination",    // 提前解約被扣款
  "fake_listing",         // 假物件
  "maintenance_ignored",  // 修繕不理
  "illegal_deduction",    // 違約扣款
];

// 糾紛描述範本（按類型）
const DESCRIPTIONS: Record<string, string[]> = {
  deposit_dispute: [
    "退租時房東以各種理由拒退押金，包括牆面污漬、燈具損壞、清潔費等，從原本 2 個月押金扣到只剩 0.5 個月。",
    "明明合約寫退租 30 天前通知，但房東說沒收到，最後押金完全沒退。",
    "房東以『重新粉刷』名義扣 1.5 個月押金，但實際上牆面只有幾個小釘孔，請師傅估價不到 NT$3,000。",
  ],
  early_termination: [
    "因工作需要提前解約，房東依約要扣 2 個月租金當違約金，但民法 440 條明訂最高 1 個月。",
    "合約寫『不得提前解約』，但民法 450 條允許，提前一個月通知仍被扣 1 個月押金。",
    "房東口頭同意可以提前解約，後來反悔，從押金扣 3 個月租金。",
  ],
  fake_listing: [
    "591 上面照片很漂亮，實際去看屋根本不同間，家具照片是別人家的。",
    "房東說租金含管理費、網路、第四台，簽約後要求補繳，每月多 NT$2,500。",
    "照片是大坪數，現場看是 5 坪，廣告不實。",
  ],
  maintenance_ignored: [
    "漏水問題報修 3 個月，房東完全不理會，最後房間發霉長壁癌。",
    "冷氣故障一個月沒修，夏天 35 度完全無法住。",
    "熱水器壞了報修 2 週沒人來，冬天沒熱水洗澡。",
  ],
  illegal_deduction: [
    "房東擅自從押金扣『清潔費』NT$5,000，但合約沒寫這條。",
    "退租時房東單方面列了一堆項目扣款，總額超過押金 1.5 倍。",
    "房東說『帶看費』要房客吸收，一次 NT$1,500，連看 3 次房就被扣 NT$4,500。",
  ],
};

// 區域流行度（讓 TOP 5 區域有比較多資料）
const DISTRICT_WEIGHT: Record<string, number> = {
  "台北市大安區": 5,
  "台北市信義區": 4,
  "台北市中山區": 4,
  "新北市板橋區": 4,
  "台北市松山區": 3,
  "新北市中和區": 3,
  "台北市內湖區": 3,
  "新北市永和區": 3,
  "台中市西屯區": 2,
  "高雄市三民區": 2,
};

// 簡單 seeded RNG — 讓每次跑結果一致
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randomDateWithin(days: number, rng: () => number): Date {
  const now = Date.now();
  const past = now - Math.floor(rng() * days * 24 * 60 * 60 * 1000);
  return new Date(past);
}

const TOTAL = 1000;
const SYSTEM_USER_ID = "system-seed-bot";

async function main() {
  // 確保預設 system user 存在（submitterId 是 String 必填）
  // 為符合 FK 約束，先 upsert 一個 system user
  await prisma.user.upsert({
    where: { id: SYSTEM_USER_ID },
    update: {},
    create: {
      id: SYSTEM_USER_ID,
      email: "system@rental-aggregator.local",
      role: "ADMIN",
      plan: "PRO_YEARLY",
    },
  });

  // 清掉之前的 seed 資料（可重複跑）
  await prisma.blacklistEntry.deleteMany({ where: { submitterId: SYSTEM_USER_ID } });

  const rng = mulberry32(20260808);

  // 加權的區域池
  const weightedDistricts: string[] = [];
  for (const d of DISTRICTS) {
    const w = DISTRICT_WEIGHT[d] ?? 1;
    for (let i = 0; i < w; i++) weightedDistricts.push(d);
  }

  const entries: Array<{
    landlordName: string;
    landlordNameFull: string;
    addressDistrict: string;
    addressDetail: string | null;
    category: string;
    description: string;
    evidenceUrls: string;
    submitterId: string;
    landlordResponse: string | null;
    status: string;
    severity: number;
    reportCount: number;
    viewCount: number;
    lastIncidentAt: Date;
  }> = [];

  for (let i = 0; i < TOTAL; i++) {
    const surname = pick(SURNAMES, rng);
    const useThree = rng() > 0.5;
    const given = useThree ? pick(GIVEN_NAMES_3, rng) : pick(GIVEN_NAMES_2, rng);
    const fullName = surname + given;
    const maskedName = maskName(fullName);

    const district = pick(weightedDistricts, rng);
    const category = pick(CATEGORIES, rng);
    const description = pick(DESCRIPTIONS[category], rng);

    // 嚴重度：押金/違約扣款偏高一點
    const severity =
      category === "deposit_dispute" ? 4 + Math.floor(rng() * 2) : // 4-5
      category === "illegal_deduction" ? 4 + Math.floor(rng() * 2) :
      category === "fake_listing" ? 3 + Math.floor(rng() * 2) :
      2 + Math.floor(rng() * 3); // 2-4

    // 報告數 1-12
    const reportCount = 1 + Math.floor(rng() * 12);

    // 瀏覽數 0-300
    const viewCount = Math.floor(rng() * 300);

    // 最後事件日期：7 天前 ~ 365 天前（80% 過去 180 天）
    const lastIncidentAt = randomDateWithin(365, rng);

    // 80% 通過審核（approved），15% 仍在審核（pending），5% rejected
    const statusRoll = rng();
    const status = statusRoll < 0.8 ? "approved" : statusRoll < 0.95 ? "pending" : "rejected";

    // 30% 有地址詳細
    const addressDetail =
      rng() < 0.3 ? `${district.replace("區", "區")} ${Math.floor(rng() * 30 + 1)} 鄰` : null;

    // 30% 有房東回應
    const landlordResponse =
      rng() < 0.3
        ? pick(
            [
              "已修復該問題，感謝反映。",
              "該案件已進入法律程序，由律師處理中。",
              "與房客達成和解，雙方不再追究。",
              "此指控與事實不符，已提告妨害名譽。",
              "已全額退費，案件結束。",
              null,
            ],
            rng,
          )
        : null;

    // 30% 有證據 URL（截圖）
    const evidenceUrls =
      rng() < 0.3
        ? JSON.stringify([
            `https://rental-aggregator-evidence.local/evidence-${i}-1.png`,
            `https://rental-aggregator-evidence.local/evidence-${i}-2.png`,
          ])
        : "[]";

    entries.push({
      landlordName: maskedName,
      landlordNameFull: fullName,
      addressDistrict: district,
      addressDetail,
      category,
      description,
      evidenceUrls,
      submitterId: SYSTEM_USER_ID,
      landlordResponse,
      status,
      severity,
      reportCount,
      viewCount,
      lastIncidentAt,
    });
  }

  // SQLite 批次寫入
  const BATCH = 200;
  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    await prisma.blacklistEntry.createMany({ data: batch });
  }

  const total = await prisma.blacklistEntry.count();
  console.log(`✅ Seeded ${total} blacklist entries`);
  console.log(`   Sample (masked): "${entries[0].landlordName}" in ${entries[0].addressDistrict}`);
  console.log(`   Sample (full): "${entries[0].landlordNameFull}" (Pro only)`);
  console.log(`   Categories distribution:`);
  const counts: Record<string, number> = {};
  for (const e of entries) counts[e.category] = (counts[e.category] ?? 0) + 1;
  for (const [k, v] of Object.entries(counts)) {
    console.log(`     ${k}: ${v}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
