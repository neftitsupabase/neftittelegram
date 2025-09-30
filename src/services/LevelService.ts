// XP Level System Service
// Based on the provided XP level table

export interface LevelInfo {
  currentLevel: number;
  currentXP: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  xpProgressInLevel: number;
  progressPercentage: number;
  isMaxLevel: boolean;
}

class LevelService {
  // XP requirements for each level (0-indexed, so level 1 = index 0)
  private static readonly XP_TABLE: number[] = [
    0,      // Level 1
    83,     // Level 2
    174,    // Level 3
    276,    // Level 4
    388,    // Level 5
    512,    // Level 6
    650,    // Level 7
    801,    // Level 8
    969,    // Level 9
    1156,   // Level 10
    1358,   // Level 11
    1584,   // Level 12
    1833,   // Level 13
    2107,   // Level 14
    2411,   // Level 15
    2746,   // Level 16
    3115,   // Level 17
    3523,   // Level 18
    3973,   // Level 19
    4470,   // Level 20
    5018,   // Level 21
    5624,   // Level 22
    6291,   // Level 23
    7028,   // Level 24
    7842,   // Level 25
    8740,   // Level 26
    9730,   // Level 27
    10824,  // Level 28
    12031,  // Level 29
    13363,  // Level 30
    14831,  // Level 31
    16456,  // Level 32
    18247,  // Level 33
    20224,  // Level 34
    22406,  // Level 35
    24815,  // Level 36
    27473,  // Level 37
    30408,  // Level 38
    33648,  // Level 39
    37224,  // Level 40
    41171,  // Level 41
    45529,  // Level 42
    50339,  // Level 43
    55649,  // Level 44
    61512,  // Level 45
    67983,  // Level 46
    75127,  // Level 47
    83014,  // Level 48
    91721,  // Level 49
    101333, // Level 50
    111945, // Level 51
    123660, // Level 52
    136591, // Level 53
    150872, // Level 54
    166636, // Level 55
    184040, // Level 56
    203254, // Level 57
    224465, // Level 58
    247886, // Level 59
    273742, // Level 60
    302288, // Level 61
    333804, // Level 62
    368599, // Level 63
    407015, // Level 64
    449428, // Level 65
    496254, // Level 66
    547953, // Level 67
    605032, // Level 68
    668051, // Level 69
    737627, // Level 70
    814445, // Level 71
    899257, // Level 72
    992895, // Level 73
    1096278, // Level 74
    1210421, // Level 75
    1336443, // Level 76
    1475581, // Level 77
    1629200, // Level 78
    1798808, // Level 79
    1986068, // Level 80
  ];

  /**
   * Calculate level information based on total XP
   */
  static calculateLevelInfo(totalXP: number): LevelInfo {
    // Ensure XP is not negative
    const xp = Math.max(0, totalXP);
    
    // Find current level
    let currentLevel = 1;
    for (let i = this.XP_TABLE.length - 1; i >= 0; i--) {
      if (xp >= this.XP_TABLE[i]) {
        currentLevel = i + 1;
        break;
      }
    }

    // Handle max level case
    const isMaxLevel = currentLevel >= this.XP_TABLE.length;
    const xpForCurrentLevel = isMaxLevel ? this.XP_TABLE[this.XP_TABLE.length - 1] : this.XP_TABLE[currentLevel - 1];
    const xpForNextLevel = isMaxLevel ? xpForCurrentLevel : this.XP_TABLE[currentLevel];
    
    // Calculate progress within current level
    const xpProgressInLevel = xp - xpForCurrentLevel;
    const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
    const progressPercentage = isMaxLevel ? 100 : Math.min(100, (xpProgressInLevel / xpNeededForNextLevel) * 100);

    return {
      currentLevel,
      currentXP: xp,
      xpForCurrentLevel,
      xpForNextLevel,
      xpProgressInLevel,
      progressPercentage,
      isMaxLevel
    };
  }

  /**
   * Get XP required for a specific level
   */
  static getXPForLevel(level: number): number {
    if (level <= 1) return 0;
    if (level > this.XP_TABLE.length) return this.XP_TABLE[this.XP_TABLE.length - 1];
    return this.XP_TABLE[level - 1];
  }

  /**
   * Get the maximum level available
   */
  static getMaxLevel(): number {
    return this.XP_TABLE.length;
  }

  /**
   * Format XP display with proper formatting
   */
  static formatXP(xp: number): string {
    if (xp >= 1000000) {
      return `${(xp / 1000000).toFixed(1)}M`;
    } else if (xp >= 1000) {
      return `${(xp / 1000).toFixed(1)}K`;
    }
    return xp.toString();
  }
}

export default LevelService;
