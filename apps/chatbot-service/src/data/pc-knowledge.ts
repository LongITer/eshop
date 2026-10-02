/**
 * PC Component Knowledge Base
 * Contains structured data about PC components, compatibility rules,
 * and recommendation logic for the chatbot rule engine.
 */

// ─── Purpose Definitions ────────────────────────────────────────────

export interface PurposeProfile {
  key: string;
  label: string;
  description: string;
  priorities: ComponentPriority;
  keywords: string[];
}

export interface ComponentPriority {
  cpu: "high" | "medium" | "low";
  gpu: "high" | "medium" | "low";
  ram: "high" | "medium" | "low";
  storage: "high" | "medium" | "low";
  psu: "medium" | "low";
  case: "low";
  motherboard: "medium" | "low";
}

export const PURPOSE_PROFILES: PurposeProfile[] = [
  {
    key: "gaming",
    label: "Chơi game",
    description: "PC dành cho chơi game, ưu tiên GPU và CPU mạnh",
    priorities: {
      cpu: "high",
      gpu: "high",
      ram: "medium",
      storage: "medium",
      psu: "medium",
      case: "low",
      motherboard: "medium",
    },
    keywords: [
      "game", "gaming", "chơi game", "fps", "esport", "pubg", "lol",
      "valorant", "gta", "cyberpunk", "stream game", "4k gaming",
    ],
  },
  {
    key: "office",
    label: "Văn phòng",
    description: "PC cho công việc văn phòng, lướt web, xem phim",
    priorities: {
      cpu: "medium",
      gpu: "low",
      ram: "medium",
      storage: "medium",
      psu: "low",
      case: "low",
      motherboard: "low",
    },
    keywords: [
      "văn phòng", "office", "word", "excel", "làm việc", "lướt web",
      "xem phim", "học online", "email", "họp online",
    ],
  },
  {
    key: "design",
    label: "Thiết kế đồ họa",
    description: "PC cho thiết kế, render 3D, video editing",
    priorities: {
      cpu: "high",
      gpu: "high",
      ram: "high",
      storage: "high",
      psu: "medium",
      case: "low",
      motherboard: "medium",
    },
    keywords: [
      "thiết kế", "đồ họa", "design", "photoshop", "illustrator",
      "premiere", "after effects", "render", "3d", "blender", "autocad",
      "video editing", "chỉnh sửa video", "dựng phim",
    ],
  },
  {
    key: "streaming",
    label: "Livestream",
    description: "PC cho livestream, recording, content creation",
    priorities: {
      cpu: "high",
      gpu: "high",
      ram: "high",
      storage: "high",
      psu: "medium",
      case: "low",
      motherboard: "medium",
    },
    keywords: [
      "stream", "livestream", "streaming", "obs", "youtube", "tiktok",
      "content creator", "recording", "quay video",
    ],
  },
  {
    key: "learning",
    label: "Học tập / Lập trình",
    description: "PC cho sinh viên, lập trình, chạy IDE",
    priorities: {
      cpu: "high",
      gpu: "low",
      ram: "high",
      storage: "medium",
      psu: "low",
      case: "low",
      motherboard: "low",
    },
    keywords: [
      "học tập", "lập trình", "code", "programming", "sinh viên",
      "java", "python", "vscode", "docker", "virtual machine", "vm",
    ],
  },
];

// ─── Budget Ranges ──────────────────────────────────────────────────

export interface BudgetRange {
  key: string;
  label: string;
  min: number;
  max: number;
  tier: string;
}

export const BUDGET_RANGES: BudgetRange[] = [
  { key: "5-10", label: "5 - 10 triệu", min: 5000000, max: 10000000, tier: "entry" },
  { key: "10-15", label: "10 - 15 triệu", min: 10000000, max: 15000000, tier: "mid" },
  { key: "15-25", label: "15 - 25 triệu", min: 15000000, max: 25000000, tier: "high" },
  { key: "25-40", label: "25 - 40 triệu", min: 25000000, max: 40000000, tier: "premium" },
  { key: "40+", label: "Trên 40 triệu", min: 40000000, max: 200000000, tier: "ultra" },
];

// ─── Component Categories (for product search) ─────────────────────

export const PC_COMPONENT_CATEGORIES = [
  "CPU", "GPU", "Card đồ họa", "VGA",
  "RAM", "Bộ nhớ",
  "SSD", "HDD", "Ổ cứng",
  "Mainboard", "Bo mạch chủ",
  "PSU", "Nguồn",
  "Case", "Vỏ máy tính",
  "Tản nhiệt", "Cooler",
  "Màn hình", "Monitor",
];

// ─── Preference Options ─────────────────────────────────────────────

export interface PreferenceOption {
  key: string;
  label: string;
  description: string;
  impact: Partial<Record<string, string>>;
}

export const PREFERENCE_OPTIONS: PreferenceOption[] = [
  {
    key: "gpu_priority",
    label: "Ưu tiên GPU mạnh",
    description: "Dành nhiều ngân sách hơn cho card đồ họa",
    impact: { gpu: "increase_budget", cpu: "decrease_budget" },
  },
  {
    key: "ram_priority",
    label: "Cần nhiều RAM",
    description: "Tăng dung lượng RAM (32GB+)",
    impact: { ram: "increase_budget" },
  },
  {
    key: "storage_priority",
    label: "Ổ cứng lớn",
    description: "Ưu tiên SSD dung lượng lớn hoặc thêm HDD",
    impact: { storage: "increase_budget" },
  },
  {
    key: "quiet",
    label: "Máy chạy êm",
    description: "Ưu tiên tản nhiệt tốt, fan êm",
    impact: { cooler: "increase_budget" },
  },
  {
    key: "compact",
    label: "Kích thước nhỏ gọn",
    description: "Case mini ITX hoặc micro ATX",
    impact: { case: "small_form_factor" },
  },
  {
    key: "none",
    label: "Không có yêu cầu đặc biệt",
    description: "Cân bằng các linh kiện",
    impact: {},
  },
];

// ─── Recommended builds (fallback when no DB templates) ─────────────

export interface FallbackBuild {
  name: string;
  purpose: string;
  budgetTier: string;
  components: Record<string, string>;
  estimatedPrice: string;
}

export const FALLBACK_BUILDS: FallbackBuild[] = [
  {
    name: "Gaming Entry Level",
    purpose: "gaming",
    budgetTier: "entry",
    components: {
      cpu: "Intel Core i3-12100F / AMD Ryzen 5 5500",
      gpu: "NVIDIA GTX 1650 / AMD RX 6500 XT",
      ram: "16GB DDR4 3200MHz",
      storage: "256GB NVMe SSD + 1TB HDD",
      motherboard: "B660M / B550M",
      psu: "500W 80+ Bronze",
      case: "Mid Tower ATX",
    },
    estimatedPrice: "8 - 10 triệu",
  },
  {
    name: "Gaming Mid Range",
    purpose: "gaming",
    budgetTier: "mid",
    components: {
      cpu: "Intel Core i5-12400F / AMD Ryzen 5 5600",
      gpu: "NVIDIA RTX 3060 / AMD RX 6600 XT",
      ram: "16GB DDR4 3600MHz",
      storage: "512GB NVMe SSD + 1TB HDD",
      motherboard: "B660 / B550",
      psu: "650W 80+ Bronze",
      case: "Mid Tower ATX",
    },
    estimatedPrice: "12 - 15 triệu",
  },
  {
    name: "Gaming High End",
    purpose: "gaming",
    budgetTier: "high",
    components: {
      cpu: "Intel Core i5-13600KF / AMD Ryzen 7 5800X3D",
      gpu: "NVIDIA RTX 4060 Ti / AMD RX 7700 XT",
      ram: "32GB DDR4 3600MHz",
      storage: "1TB NVMe SSD",
      motherboard: "Z690 / X570",
      psu: "750W 80+ Gold",
      case: "Mid Tower ATX",
    },
    estimatedPrice: "20 - 25 triệu",
  },
  {
    name: "Office Basic",
    purpose: "office",
    budgetTier: "entry",
    components: {
      cpu: "Intel Core i3-12100 / AMD Ryzen 3 4100",
      gpu: "Integrated Graphics (iGPU)",
      ram: "8GB DDR4 3200MHz",
      storage: "256GB NVMe SSD",
      motherboard: "H610M / A520M",
      psu: "400W 80+",
      case: "Mini Tower",
    },
    estimatedPrice: "5 - 7 triệu",
  },
  {
    name: "Design Workstation",
    purpose: "design",
    budgetTier: "high",
    components: {
      cpu: "Intel Core i7-13700 / AMD Ryzen 7 7700X",
      gpu: "NVIDIA RTX 4060 / AMD RX 7600",
      ram: "32GB DDR5 5200MHz",
      storage: "1TB NVMe SSD + 2TB HDD",
      motherboard: "B760 / B650",
      psu: "750W 80+ Gold",
      case: "Mid Tower ATX",
    },
    estimatedPrice: "22 - 28 triệu",
  },
  {
    name: "Streaming Setup",
    purpose: "streaming",
    budgetTier: "premium",
    components: {
      cpu: "Intel Core i7-13700K / AMD Ryzen 9 7900X",
      gpu: "NVIDIA RTX 4070 / AMD RX 7800 XT",
      ram: "32GB DDR5 5600MHz",
      storage: "1TB NVMe SSD + 2TB HDD",
      motherboard: "Z790 / X670",
      psu: "850W 80+ Gold",
      case: "Full Tower ATX",
    },
    estimatedPrice: "30 - 38 triệu",
  },
  {
    name: "Student / Developer PC",
    purpose: "learning",
    budgetTier: "mid",
    components: {
      cpu: "Intel Core i5-12400 / AMD Ryzen 5 5600G",
      gpu: "Integrated Graphics hoặc GTX 1650",
      ram: "16GB DDR4 3200MHz",
      storage: "512GB NVMe SSD",
      motherboard: "B660M / B550M",
      psu: "500W 80+ Bronze",
      case: "Mini Tower",
    },
    estimatedPrice: "8 - 12 triệu",
  },
];

// ─── Helper Functions ───────────────────────────────────────────────

/**
 * Detect purpose from user's message text
 */
export function detectPurpose(message: string): PurposeProfile | null {
  const lowerMsg = message.toLowerCase();
  for (const profile of PURPOSE_PROFILES) {
    for (const keyword of profile.keywords) {
      if (lowerMsg.includes(keyword.toLowerCase())) {
        return profile;
      }
    }
  }
  return null;
}

/**
 * Detect budget range from user's message text
 */
export function detectBudget(message: string): BudgetRange | null {
  const lowerMsg = message.toLowerCase();

  // Match patterns like "15 triệu", "15tr", "15.000.000", "15000000"
  const amountMatch = lowerMsg.match(
    /(\d+(?:[.,]\d+)?)\s*(?:triệu|tr|trieu|củ|cu|\.000\.000|000000)/
  );
  if (amountMatch) {
    const amount = parseFloat(amountMatch[1].replace(",", ".")) * 1000000;
    return BUDGET_RANGES.find((b) => amount >= b.min && amount <= b.max) || null;
  }

  // Match budget range keys directly
  for (const range of BUDGET_RANGES) {
    if (lowerMsg.includes(range.key) || lowerMsg.includes(range.label.toLowerCase())) {
      return range;
    }
  }

  return null;
}

/**
 * Detect preferences from user's message
 */
export function detectPreferences(message: string): PreferenceOption[] {
  const lowerMsg = message.toLowerCase();
  const matched: PreferenceOption[] = [];

  if (/gpu|card|vga|đồ họa/.test(lowerMsg)) {
    matched.push(PREFERENCE_OPTIONS.find((p) => p.key === "gpu_priority")!);
  }
  if (/ram|bộ nhớ|memory/.test(lowerMsg)) {
    matched.push(PREFERENCE_OPTIONS.find((p) => p.key === "ram_priority")!);
  }
  if (/ổ cứng|ssd|hdd|storage|lưu trữ/.test(lowerMsg)) {
    matched.push(PREFERENCE_OPTIONS.find((p) => p.key === "storage_priority")!);
  }
  if (/êm|quiet|im lặng|không ồn/.test(lowerMsg)) {
    matched.push(PREFERENCE_OPTIONS.find((p) => p.key === "quiet")!);
  }
  if (/nhỏ gọn|mini|compact|itx/.test(lowerMsg)) {
    matched.push(PREFERENCE_OPTIONS.find((p) => p.key === "compact")!);
  }

  return matched.length > 0
    ? matched
    : [PREFERENCE_OPTIONS.find((p) => p.key === "none")!];
}

/**
 * Get fallback build recommendation based on purpose and budget
 */
export function getFallbackBuild(
  purpose: string,
  budgetTier: string
): FallbackBuild | null {
  // Exact match
  let build = FALLBACK_BUILDS.find(
    (b) => b.purpose === purpose && b.budgetTier === budgetTier
  );
  if (build) return build;

  // Fallback: same purpose, closest tier
  const tierOrder = ["entry", "mid", "high", "premium", "ultra"];
  const targetIdx = tierOrder.indexOf(budgetTier);
  const samePurpose = FALLBACK_BUILDS.filter((b) => b.purpose === purpose);

  if (samePurpose.length > 0) {
    samePurpose.sort(
      (a, b) =>
        Math.abs(tierOrder.indexOf(a.budgetTier) - targetIdx) -
        Math.abs(tierOrder.indexOf(b.budgetTier) - targetIdx)
    );
    return samePurpose[0];
  }

  return null;
}
