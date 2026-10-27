/**
 * finance.js — 理財計算引擎
 * 提供 PV（現值）、FV（終值）、PMT（每期付款）與理財目標分析功能
 * 所有函式為純函式，便於測試與重用
 */
(function (global) {
  'use strict';

  var Finance = {};

  /**
   * 將年利率轉換為每期利率
   * @param {number} annualRate 年利率（小數，例如 0.05 代表 5%）
   * @param {number} periodsPerYear 每年複利期數（12=月, 4=季, 1=年）
   * @returns {number} 每期利率
   */
  Finance.periodicRate = function (annualRate, periodsPerYear) {
    return annualRate / periodsPerYear;
  };

  /**
   * 終值因數 (1 + r)^n
   */
  function fvFactor(r, n) {
    return Math.pow(1 + r, n);
  }

  /**
   * 現值因數 1 / (1 + r)^n
   */
  function pvFactor(r, n) {
    return 1 / fvFactor(r, n);
  }

  /**
   * 年金終值因數 [(1+r)^n - 1] / r
   * 處理 r = 0 的邊界情況
   */
  function annuityFvFactor(r, n) {
    if (Math.abs(r) < 1e-12) return n;
    return (fvFactor(r, n) - 1) / r;
  }

  /**
   * 年金現值因數 [1 - (1+r)^-n] / r
   */
  function annuityPvFactor(r, n) {
    if (Math.abs(r) < 1e-12) return n;
    return (1 - pvFactor(r, n)) / r;
  }

  /**
   * FV — 終值計算
   * @param {Object} p
   * @param {number} p.pv 現值（目前投入金額，可為 0）
   * @param {number} p.pmt 每期付款（每期固定投入，期末投入；可為 0）
   * @param {number} p.annualRate 年利率（小數）
   * @param {number} p.years 年數
   * @param {number} [p.periodsPerYear=12] 每年期數（預設每月）
   * @param {boolean} [p.pmtAtBeginning=false] 付款在期初（預設期末）
   * @returns {number} 終值
   */
  Finance.FV = function (p) {
    var r = Finance.periodicRate(p.annualRate, p.periodsPerYear || 12);
    var n = Math.round(p.years * (p.periodsPerYear || 12));
    var pv = p.pv || 0;
    var pmt = p.pmt || 0;
    var fvLump = pv * fvFactor(r, n);
    var fvAnnuity = pmt * annuityFvFactor(r, n);
    if (p.pmtAtBeginning) fvAnnuity *= (1 + r);
    return fvLump + fvAnnuity;
  };

  /**
   * PV — 現值計算
   * 已知終值（與/或每期付款），回推現在應投入多少
   * @param {Object} p
   * @param {number} p.fv 目標終值
   * @param {number} [p.pmt=0] 每期付款
   * @param {number} p.annualRate 年利率
   * @param {number} p.years 年數
   * @param {number} [p.periodsPerYear=12] 每年期數
   * @param {boolean} [p.pmtAtBeginning=false]
   * @returns {number} 現值
   */
  Finance.PV = function (p) {
    var r = Finance.periodicRate(p.annualRate, p.periodsPerYear || 12);
    var n = Math.round(p.years * (p.periodsPerYear || 12));
    var fv = p.fv || 0;
    var pmt = p.pmt || 0;
    var pvLump = fv * pvFactor(r, n);
    var pvAnnuity = pmt * annuityPvFactor(r, n);
    if (p.pmtAtBeginning) pvAnnuity *= (1 + r);
    return pvLump - pvAnnuity;
  };

  /**
   * PMT — 每期應付款金額
   * 情境 A（貸款）：已知 PV（貸款本金），求每期應攤還金額
   * 情境 B（儲蓄目標）：已知 FV（目標金額），求每期應投入金額
   * @param {Object} p
   * @param {number} [p.pv] 現值（貸款本金；與 fv 至少給一個）
   * @param {number} [p.fv] 終值（儲蓄目標；可與 pv 同時給）
   * @param {number} p.annualRate 年利率
   * @param {number} p.years 年數
   * @param {number} [p.periodsPerYear=12] 每年期數
   * @param {boolean} [p.pmtAtBeginning=false]
   * @returns {number} 每期付款（正數）
   */
  Finance.PMT = function (p) {
    var r = Finance.periodicRate(p.annualRate, p.periodsPerYear || 12);
    var n = Math.round(p.years * (p.periodsPerYear || 12));
    var pv = p.pv || 0;
    var fv = p.fv || 0;
    var denom;
    if (Math.abs(r) < 1e-12) {
      denom = n;
    } else {
      denom = annuityPvFactor(r, n);
    }
    if (p.pmtAtBeginning) denom *= (1 + r);
    // PMT = -(PV + FV/(1+r)^n) / annuityPvFactor
    // 這裡回傳正數（代表每期需付出的金額）
    var numerator = pv + fv * pvFactor(r, n);
    if (Math.abs(denom) < 1e-12) return 0;
    return numerator / denom;
  };

  /**
   * 計算達成目標所需的年報酬率（牛頓迭代法）
   * 已知 PV、PMT、目標 FV、年數，求所需的年化報酬率
   * @returns {number|null} 年利率（小數），若無解回傳 null
   */
  Finance.requiredRate = function (p) {
    var pv = p.pv || 0;
    var pmt = p.pmt || 0;
    var fv = p.fv || 0;
    var years = p.years;
    var ppy = p.periodsPerYear || 12;
    // 邊界：完全沒有投入也沒有現值
    if (pv <= 0 && pmt <= 0) return null;
    // 定義 f(rate) = FV(rate) - target
    function diff(annualRate) {
      return Finance.FV({
        pv: pv, pmt: pmt, annualRate: annualRate,
        years: years, periodsPerYear: ppy
      }) - fv;
    }
    // 二分法在 [0, 1]（0% ~ 100%）區間找根
    var lo = 0, hi = 1;
    var flo = diff(lo), fhi = diff(hi);
    if (flo >= 0) return 0; // 0% 就達成
    if (fhi < 0) return null; // 100% 仍不足
    for (var i = 0; i < 100; i++) {
      var mid = (lo + hi) / 2;
      var fm = diff(mid);
      if (Math.abs(fm) < 0.01) return mid;
      if (fm < 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  };

  /**
   * 產生成長軌跡（每期期末的累積金額），用於圖表與攤還表
   * @returns {Array<{period:number, year:number, contribution:number, interest:number, balance:number}>}
   */
  Finance.growthSchedule = function (p) {
    var r = Finance.periodicRate(p.annualRate, p.periodsPerYear || 12);
    var n = Math.round(p.years * (p.periodsPerYear || 12));
    var ppy = p.periodsPerYear || 12;
    var balance = p.pv || 0;
    var pmt = p.pmt || 0;
    var schedule = [];
    var totalContrib = balance;
    var totalInterest = 0;
    schedule.push({
      period: 0, year: 0,
      contribution: totalContrib, interest: 0, balance: balance
    });
    for (var i = 1; i <= n; i++) {
      var interest = balance * r;
      if (p.pmtAtBeginning) {
        balance = (balance + pmt) * (1 + r);
        totalContrib += pmt;
      } else {
        balance = balance * (1 + r) + pmt;
        totalContrib += pmt;
      }
      totalInterest = balance - totalContrib;
      schedule.push({
        period: i,
        year: i / ppy,
        contribution: totalContrib,
        interest: totalInterest,
        balance: balance
      });
    }
    return schedule;
  };

  /**
   * 貸款攤還表（PMT 已知，計算每期本金與利息）
   * @returns {Array<{period:number, payment:number, principal:number, interest:number, balance:number}>}
   */
  Finance.amortizationSchedule = function (p) {
    var r = Finance.periodicRate(p.annualRate, p.periodsPerYear || 12);
    var n = Math.round(p.years * (p.periodsPerYear || 12));
    var balance = p.pv || 0;
    var pmt = Finance.PMT(p);
    var schedule = [];
    for (var i = 1; i <= n; i++) {
      var interest = balance * r;
      var principal = pmt - interest;
      balance = Math.max(0, balance - principal);
      schedule.push({
        period: i, payment: pmt, principal: principal,
        interest: interest, balance: balance
      });
    }
    return schedule;
  };

  /**
   * 理財目標分析
   * 輸入目標金額、現有資產、每月可投入、預期報酬率、期限
   * 輸出：預估終值、達成率、缺口、建議
   * @param {Object} p
   * @param {number} p.goalAmount 目標金額（FV）
   * @param {number} p.currentSavings 現有儲蓄（PV）
   * @param {number} p.monthlyContribution 每月投入（PMT）
   * @param {number} p.expectedReturn 預期年化報酬率（小數）
   * @param {number} p.years 期限（年）
   * @returns {Object} 分析結果
   */
  Finance.analyzeGoal = function (p) {
    var ppy = 12;
    var projectedFv = Finance.FV({
      pv: p.currentSavings,
      pmt: p.monthlyContribution,
      annualRate: p.expectedReturn,
      years: p.years,
      periodsPerYear: ppy
    });
    var gap = projectedFv - p.goalAmount; // 正=超標，負=不足
    var achievementRate = p.goalAmount > 0 ? projectedFv / p.goalAmount : 1;

    // 若不足，計算三種調整方案
    var suggestions = [];
    if (gap < 0) {
      // 方案 1：提高每月投入（維持報酬率與期限）
      var requiredPmt = Finance.PMT({
        pv: p.currentSavings,
        fv: p.goalAmount,
        annualRate: p.expectedReturn,
        years: p.years,
        periodsPerYear: ppy
      });
      suggestions.push({
        type: 'increase-pmt',
        title: '提高每月投入',
        description: '維持目前報酬率與期限，每月應投入金額由 NT$' +
          formatNum(p.monthlyContribution) + ' 提高至 NT$' + formatNum(requiredPmt) +
          '（每月增加 NT$' + formatNum(requiredPmt - p.monthlyContribution) + '）。',
        value: requiredPmt,
        unit: '每月'
      });

      // 方案 2：延長期限（維持投入與報酬率）
      // 求所需年數：FV = PV*(1+r)^n + PMT*[(1+r)^n-1]/r
      var r = p.expectedReturn / ppy;
      var pv = p.currentSavings, pmt = p.monthlyContribution, fv = p.goalAmount;
      var requiredMonths = null;
      if (Math.abs(r) < 1e-12) {
        if (pmt > 0) requiredMonths = (fv - pv) / pmt;
      } else {
        // (1+r)^n = (fv*r + pmt) / (pv*r + pmt)
        var numerator = fv * r + pmt;
        var denominator = pv * r + pmt;
        if (denominator > 0 && numerator / denominator > 1) {
          requiredMonths = Math.log(numerator / denominator) / Math.log(1 + r);
        }
      }
      if (requiredMonths !== null) {
        var requiredYears = requiredMonths / ppy;
        if (requiredYears > p.years && isFinite(requiredYears)) {
          suggestions.push({
            type: 'extend-time',
            title: '延長達成期限',
            description: '維持每月投入與報酬率，需將期限由 ' + p.years +
              ' 年延長至約 ' + requiredYears.toFixed(1) + ' 年（多 ' +
              (requiredYears - p.years).toFixed(1) + ' 年）。',
            value: requiredYears,
            unit: '年'
          });
        }
      }

      // 方案 3：提高預期報酬率
      var reqRate = Finance.requiredRate({
        pv: p.currentSavings, pmt: p.monthlyContribution,
        fv: p.goalAmount, years: p.years, periodsPerYear: ppy
      });
      if (reqRate !== null && reqRate > p.expectedReturn) {
        suggestions.push({
          type: 'increase-return',
          title: '提高投資報酬率',
          description: '維持每月投入與期限，需將年化報酬率由 ' +
            (p.expectedReturn * 100).toFixed(1) + '% 提高至約 ' +
            (reqRate * 100).toFixed(1) + '%（注意：更高報酬伴隨更高風險）。',
          value: reqRate * 100,
          unit: '% 年化'
        });
      }

      // 方案 4：降低目標金額
      suggestions.push({
        type: 'lower-goal',
        title: '調整目標金額',
        description: '依目前投入與報酬率，預估可累積 NT$' +
          formatNum(projectedFv) + '，可考慮將目標下修至此金額，或分段達成。',
        value: projectedFv,
        unit: '可達成金額'
      });
    } else {
      suggestions.push({
        type: 'on-track',
        title: '目標可達成',
        description: '依目前規劃，到期時預估可累積 NT$' + formatNum(projectedFv) +
          '，超出目標 NT$' + formatNum(gap) + '。建議維持紀律，並適時檢視資產配置。',
        value: gap,
        unit: '超額'
      });
      suggestions.push({
        type: 'reduce-risk',
        title: '可考慮降低風險',
        description: '既然可超標達成，可考慮將部分資產轉至較穩健配置，鎖定獲利、降低波動。',
        value: null,
        unit: ''
      });
    }

    // 三種情境（保守/穩健/積極）的預估終值
    var scenarios = [
      { label: '保守 (2%)', rate: 0.02, fv: Finance.FV({ pv: p.currentSavings, pmt: p.monthlyContribution, annualRate: 0.02, years: p.years, periodsPerYear: ppy }) },
      { label: '穩健 (5%)', rate: 0.05, fv: Finance.FV({ pv: p.currentSavings, pmt: p.monthlyContribution, annualRate: 0.05, years: p.years, periodsPerYear: ppy }) },
      { label: '積極 (8%)', rate: 0.08, fv: Finance.FV({ pv: p.currentSavings, pmt: p.monthlyContribution, annualRate: 0.08, years: p.years, periodsPerYear: ppy }) }
    ];

    return {
      projectedFv: projectedFv,
      gap: gap,
      achievementRate: achievementRate,
      onTrack: gap >= 0,
      suggestions: suggestions,
      scenarios: scenarios,
      schedule: Finance.growthSchedule({
        pv: p.currentSavings, pmt: p.monthlyContribution,
        annualRate: p.expectedReturn, years: p.years, periodsPerYear: ppy
      })
    };
  };

  /** 數字格式化（千分位，無小數） */
  function formatNum(n) {
    if (!isFinite(n)) return '—';
    return Math.round(n).toLocaleString('en-US');
  }
  Finance.formatNum = formatNum;

  /** 貨幣格式化（NT$） */
  Finance.formatMoney = function (n) {
    return 'NT$' + formatNum(n);
  };

  global.Finance = Finance;
})(window);
