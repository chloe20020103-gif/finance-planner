/**
 * app.js — 理財目標規劃師互動邏輯
 * 頁籤切換、即時計算、ECharts 圖表、建議渲染
 */
(function () {
  'use strict';

  // ---------- 調色盤（與 CSS 變數一致） ----------
  var C = {
    bg: '#1c1f2e', card: '#262a3a', text: '#e8ecf4', muted: '#8b9ab8',
    accent: '#c9923c', accent2: '#4d8b7a', border: 'rgba(139,154,184,0.16)',
    danger: '#c45a5a'
  };

  // 共用 ECharts 主題設定
  var baseAxis = {
    axisLine: { lineStyle: { color: C.border } },
    axisLabel: { color: C.muted, fontSize: 11 },
    splitLine: { lineStyle: { color: C.border, type: 'dashed' } },
    axisTick: { show: false }
  };
  var baseTooltip = {
    backgroundColor: C.card,
    borderColor: C.border,
    textStyle: { color: C.text, fontSize: 12 },
    borderWidth: 1
  };

  function fmt(n) { return Finance.formatNum(n); }
  function money(n) { return Finance.formatMoney(n); }

  // ---------- 圖表實例管理（避免重複 init） ----------
  var charts = {};
  function getChart(id) {
    if (!charts[id]) {
      var el = document.getElementById(id);
      if (!el) return null;
      charts[id] = echarts.init(el);
    }
    return charts[id];
  }
  window.addEventListener('resize', function () {
    Object.keys(charts).forEach(function (k) { charts[k].resize(); });
  });

  // ---------- Lucide 圖示 ----------
  function renderIcons() {
    if (window.lucide && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  }

  // ============================================================
  // 頁籤切換
  // ============================================================
  var tabBtns = document.querySelectorAll('.tab-btn');
  var panels = document.querySelectorAll('.tab-panel');
  var navLinks = document.querySelectorAll('[data-nav]');

  function activateTab(name) {
    tabBtns.forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    panels.forEach(function (p) {
      p.classList.toggle('active', p.id === 'panel-' + name);
    });
    navLinks.forEach(function (a) {
      a.classList.toggle('active', a.dataset.nav === name);
    });
    // 切換後重繪該頁籤內的圖表（ECharts 在 display:none 時尺寸為 0）
    setTimeout(function () {
      Object.keys(charts).forEach(function (k) { charts[k].resize(); });
    }, 50);
  }

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () { activateTab(btn.dataset.tab); });
  });
  navLinks.forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      activateTab(a.dataset.nav);
      document.querySelector('.tabs').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // ============================================================
  // 面板 1：理財目標規劃
  // ============================================================
  (function goalPlanner() {
    var $ = function (id) { return document.getElementById(id); };
    var g_goal = $('g_goal'), g_pv = $('g_pv'), g_pmt = $('g_pmt');
    var g_rate = $('g_rate'), g_years = $('g_years');
    var g_rate_val = $('g_rate_val'), g_years_val = $('g_years_val');

    // 目標快捷鍵
    document.querySelectorAll('#goalChips .goal-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('#goalChips .goal-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        g_goal.value = chip.dataset.amount;
        g_years.value = chip.dataset.years;
        g_years_val.textContent = chip.dataset.years + ' 年';
        compute();
      });
    });

    g_rate.addEventListener('input', function () { g_rate_val.textContent = (+g_rate.value).toFixed(1) + '%'; compute(); });
    g_years.addEventListener('input', function () { g_years_val.textContent = g_years.value + ' 年'; compute(); });
    [g_goal, g_pv, g_pmt].forEach(function (el) { el.addEventListener('input', compute); });

    function compute() {
      var goal = Math.max(0, +g_goal.value || 0);
      var pv = Math.max(0, +g_pv.value || 0);
      var pmt = Math.max(0, +g_pmt.value || 0);
      var rate = (+g_rate.value) / 100;
      var years = +g_years.value;

      var result = Finance.analyzeGoal({
        goalAmount: goal, currentSavings: pv,
        monthlyContribution: pmt, expectedReturn: rate, years: years
      });

      // KPI
      $('g_proj_fv').textContent = money(result.projectedFv);
      var gapEl = $('g_gap');
      if (result.gap >= 0) {
        gapEl.textContent = '+' + money(result.gap);
        gapEl.className = 'kpi-value good';
      } else {
        gapEl.textContent = '-' + money(Math.abs(result.gap));
        gapEl.className = 'kpi-value bad';
      }
      var last = result.schedule[result.schedule.length - 1];
      $('g_contrib').textContent = money(last.contribution);
      $('g_interest').textContent = money(last.interest);

      // 狀態徽章
      var badge = $('g_status_badge');
      var badgeText = $('g_status_text');
      var achText = $('g_achievement_text');
      var achPct = Math.min(999, result.achievementRate * 100);
      achText.textContent = '達成率 ' + achPct.toFixed(1) + '%';
      if (result.onTrack) {
        badge.className = 'badge good';
        badgeText.textContent = '可達成';
      } else if (achPct >= 70) {
        badge.className = 'badge warn';
        badgeText.textContent = '略不足';
      } else {
        badge.className = 'badge danger';
        badgeText.textContent = '差距大';
      }

      // 進度條
      var pct = Math.min(100, result.achievementRate * 100);
      $('g_progress').style.width = pct + '%';
      $('g_progress_label').textContent = '目標 ' + money(goal);

      // 建議
      var sugBox = $('g_suggestions');
      sugBox.innerHTML = '';
      result.suggestions.forEach(function (s) {
        var div = document.createElement('div');
        var cls = result.onTrack ? 'good' : 'warn';
        div.className = 'suggestion ' + cls;
        var iconName = s.type === 'increase-pmt' ? 'wallet' :
                       s.type === 'extend-time' ? 'clock' :
                       s.type === 'increase-return' ? 'trending-up' :
                       s.type === 'lower-goal' ? 'target' :
                       s.type === 'on-track' ? 'check-circle-2' : 'shield-check';
        div.innerHTML =
          '<div class="suggestion-icon"><i data-lucide="' + iconName + '"></i></div>' +
          '<div class="suggestion-body"><h4>' + s.title + '</h4><p>' + s.description + '</p></div>';
        sugBox.appendChild(div);
      });
      renderIcons();

      // 圖表 1：成長軌跡（取每年樣本點，避免點過多）
      var schedule = result.schedule;
      var yearly = [];
      for (var y = 0; y <= years; y++) {
        var idx = Math.min(schedule.length - 1, y * 12);
        yearly.push({
          year: y,
          contribution: schedule[idx].contribution,
          interest: schedule[idx].interest,
          balance: schedule[idx].balance
        });
      }
      var growthChart = getChart('chart_growth');
      if (growthChart) {
        growthChart.setOption({
          tooltip: Object.assign({}, baseTooltip, {
            trigger: 'axis',
            valueFormatter: function (v) { return money(v); }
          }),
          legend: { textStyle: { color: C.muted }, top: 0, icon: 'roundRect' },
          grid: { left: 60, right: 20, top: 40, bottom: 30 },
          xAxis: Object.assign({ type: 'category', data: yearly.map(function (d) { return d.year + '年'; }) }, baseAxis),
          yAxis: Object.assign({ type: 'value', axisLabel: { color: C.muted, fontSize: 11, formatter: function (v) { return (v / 10000) + '萬'; } } }, baseAxis),
          series: [
            {
              name: '累計投入本金', type: 'line', stack: 'total',
              areaStyle: { color: 'rgba(139,154,184,0.25)' },
              lineStyle: { color: C.muted, width: 1 },
              itemStyle: { color: C.muted },
              data: yearly.map(function (d) { return Math.round(d.contribution); }),
              symbol: 'none', smooth: true
            },
            {
              name: '累計利息收益', type: 'line', stack: 'total',
              areaStyle: { color: 'rgba(201,146,60,0.35)' },
              lineStyle: { color: C.accent, width: 2 },
              itemStyle: { color: C.accent },
              data: yearly.map(function (d) { return Math.round(d.interest); }),
              symbol: 'none', smooth: true
            },
            {
              name: '目標金額', type: 'line',
              lineStyle: { color: C.danger, type: 'dashed', width: 1.5 },
              itemStyle: { color: C.danger },
              data: yearly.map(function () { return goal; }),
              symbol: 'none'
            }
          ]
        }, true);
      }

      // 圖表 2：三情境比較（長條）
      var scChart = getChart('chart_scenario');
      if (scChart) {
        var sc = result.scenarios;
        scChart.setOption({
          tooltip: Object.assign({}, baseTooltip, {
            trigger: 'axis',
            valueFormatter: function (v) { return money(v); }
          }),
          grid: { left: 60, right: 20, top: 30, bottom: 30 },
          xAxis: Object.assign({ type: 'category', data: sc.map(function (d) { return d.label; }) }, baseAxis),
          yAxis: Object.assign({ type: 'value', axisLabel: { color: C.muted, fontSize: 11, formatter: function (v) { return (v / 10000) + '萬'; } } }, baseAxis),
          series: [{
            type: 'bar',
            barWidth: '50%',
            data: sc.map(function (d, i) {
              return {
                value: Math.round(d.fv),
                itemStyle: {
                  color: i === 0 ? C.muted : (i === 1 ? C.accent2 : C.accent),
                  borderRadius: [6, 6, 0, 0]
                }
              };
            }),
            label: { show: true, position: 'top', color: C.text, fontSize: 11, formatter: function (p) { return (p.value / 10000).toFixed(0) + '萬'; } },
            markLine: {
              silent: true,
              symbol: 'none',
              lineStyle: { color: C.danger, type: 'dashed', width: 1.5 },
              label: { color: C.danger, formatter: '目標 ' + (goal / 10000).toFixed(0) + '萬', position: 'insideEndTop' },
              data: [{ yAxis: goal }]
            }
          }]
        }, true);
      }
    }

    compute();
  })();

  // ============================================================
  // 面板 2：FV 終值計算
  // ============================================================
  (function fvCalc() {
    var $ = function (id) { return document.getElementById(id); };
    var ids = ['fv_pv', 'fv_pmt', 'fv_rate', 'fv_years', 'fv_ppy', 'fv_begin'];
    ids.forEach(function (id) {
      $(id).addEventListener('input', compute);
      $(id).addEventListener('change', compute);
    });
    $('fv_rate').addEventListener('input', function () { $('fv_rate_val').textContent = (+this.value).toFixed(1) + '%'; });
    $('fv_years').addEventListener('input', function () { $('fv_years_val').textContent = this.value + ' 年'; });

    function compute() {
      var pv = +$('fv_pv').value || 0;
      var pmt = +$('fv_pmt').value || 0;
      var rate = (+$('fv_rate').value) / 100;
      var years = +$('fv_years').value;
      var ppy = +$('fv_ppy').value;
      var begin = $('fv_begin').checked;

      var fv = Finance.FV({ pv: pv, pmt: pmt, annualRate: rate, years: years, periodsPerYear: ppy, pmtAtBeginning: begin });
      var totalContrib = pv + pmt * years * ppy;
      var interest = fv - totalContrib;

      $('fv_result').textContent = money(fv);
      $('fv_contrib').textContent = money(totalContrib);
      $('fv_interest').textContent = money(interest);
      $('fv_multiple').textContent = totalContrib > 0 ? (fv / totalContrib).toFixed(2) + 'x' : '—';

      // 成長曲線
      var schedule = Finance.growthSchedule({ pv: pv, pmt: pmt, annualRate: rate, years: years, periodsPerYear: ppy, pmtAtBeginning: begin });
      var yearly = [];
      for (var y = 0; y <= years; y++) {
        var idx = Math.min(schedule.length - 1, Math.round(y * ppy));
        yearly.push({ year: y, balance: schedule[idx].balance, contribution: schedule[idx].contribution });
      }
      var ch = getChart('chart_fv');
      if (ch) {
        ch.setOption({
          tooltip: Object.assign({}, baseTooltip, { trigger: 'axis', valueFormatter: function (v) { return money(v); } }),
          legend: { textStyle: { color: C.muted }, top: 0, icon: 'roundRect' },
          grid: { left: 60, right: 20, top: 40, bottom: 30 },
          xAxis: Object.assign({ type: 'category', data: yearly.map(function (d) { return d.year + '年'; }) }, baseAxis),
          yAxis: Object.assign({ type: 'value', scale: true, axisLabel: { color: C.muted, fontSize: 11, formatter: function (v) { return (v / 10000) + '萬'; } } }, baseAxis),
          series: [
            {
              name: '資產餘額', type: 'line', smooth: true, symbol: 'none',
              lineStyle: { color: C.accent, width: 2.5 },
              areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(201,146,60,0.4)' }, { offset: 1, color: 'rgba(201,146,60,0.02)' }]) },
              itemStyle: { color: C.accent },
              data: yearly.map(function (d) { return Math.round(d.balance); })
            },
            {
              name: '累計投入', type: 'line', smooth: true, symbol: 'none',
              lineStyle: { color: C.muted, width: 1.5, type: 'dashed' },
              itemStyle: { color: C.muted },
              data: yearly.map(function (d) { return Math.round(d.contribution); })
            }
          ]
        }, true);
      }
    }
    compute();
  })();

  // ============================================================
  // 面板 3：PV 現值計算
  // ============================================================
  (function pvCalc() {
    var $ = function (id) { return document.getElementById(id); };
    ['pv_fv', 'pv_pmt', 'pv_rate', 'pv_years', 'pv_ppy'].forEach(function (id) {
      $(id).addEventListener('input', compute);
      $(id).addEventListener('change', compute);
    });
    $('pv_rate').addEventListener('input', function () { $('pv_rate_val').textContent = (+this.value).toFixed(1) + '%'; });
    $('pv_years').addEventListener('input', function () { $('pv_years_val').textContent = this.value + ' 年'; });

    function compute() {
      var fv = +$('pv_fv').value || 0;
      var pmt = +$('pv_pmt').value || 0;
      var rate = (+$('pv_rate').value) / 100;
      var years = +$('pv_years').value;
      var ppy = +$('pv_ppy').value;

      var pv = Finance.PV({ fv: fv, pmt: pmt, annualRate: rate, years: years, periodsPerYear: ppy });
      var r = rate / ppy, n = years * ppy;
      var factor = Math.pow(1 + r, -n);

      $('pv_result').textContent = money(Math.max(0, pv));
      $('pv_discount').textContent = money(fv - Math.max(0, pv));
      $('pv_factor').textContent = factor.toFixed(4);

      // 不同利率下的現值敏感度曲線
      var rates = [];
      var pvs = [];
      for (var rr = 0; rr <= 15; rr += 0.5) {
        rates.push(rr + '%');
        pvs.push(Math.round(Math.max(0, Finance.PV({ fv: fv, pmt: pmt, annualRate: rr / 100, years: years, periodsPerYear: ppy }))));
      }
      var ch = getChart('chart_pv');
      if (ch) {
        ch.setOption({
          tooltip: Object.assign({}, baseTooltip, { trigger: 'axis', valueFormatter: function (v) { return money(v); } }),
          grid: { left: 60, right: 20, top: 30, bottom: 30 },
          xAxis: Object.assign({ type: 'category', name: '年利率', data: rates }, baseAxis),
          yAxis: Object.assign({ type: 'value', scale: true, axisLabel: { color: C.muted, fontSize: 11, formatter: function (v) { return (v / 10000) + '萬'; } } }, baseAxis),
          series: [{
            name: '所需現值', type: 'line', smooth: true, symbol: 'none',
            lineStyle: { color: C.accent2, width: 2.5 },
            areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(77,139,122,0.35)' }, { offset: 1, color: 'rgba(77,139,122,0.02)' }]) },
            itemStyle: { color: C.accent2 },
            data: pvs,
            markPoint: {
              symbol: 'circle', symbolSize: 10,
              itemStyle: { color: C.accent, borderColor: C.card, borderWidth: 2 },
              label: { show: false },
              data: [{ coord: [(rate * 100) / 0.5, Math.round(Math.max(0, pv))], name: '目前' }]
            }
          }]
        }, true);
      }
    }
    compute();
  })();

  // ============================================================
  // 面板 4：PMT 每期付款
  // ============================================================
  (function pmtCalc() {
    var $ = function (id) { return document.getElementById(id); };
    var mode = 'save'; // save | loan

    document.querySelectorAll('#pmtModeChips .goal-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('#pmtModeChips .goal-chip').forEach(function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        mode = chip.dataset.mode;
        $('pmt_save_fields').style.display = mode === 'save' ? '' : 'none';
        $('pmt_loan_fields').style.display = mode === 'loan' ? '' : 'none';
        $('pmt_save_rate_row').style.display = mode === 'save' ? '' : 'none';
        $('pmt_loan_years_row').style.display = mode === 'loan' ? '' : 'none';
        $('pmt_amort_wrap').style.display = mode === 'loan' ? '' : 'none';
        $('pmt_result_label').textContent = mode === 'save' ? '每期應投入 PMT' : '每期應繳 PMT（本息平均）';
        $('pmt_total_lbl').textContent = mode === 'save' ? '累計投入總額' : '累計還款總額';
        $('pmt_interest_lbl').textContent = mode === 'save' ? '累計利息收益' : '累計利息支出';
        compute();
      });
    });

    ['pmt_fv', 'pmt_pv_save', 'pmt_rate', 'pmt_years', 'pmt_pv_loan', 'pmt_loan_rate', 'pmt_loan_years', 'pmt_ppy'].forEach(function (id) {
      var el = $(id);
      if (el) {
        el.addEventListener('input', compute);
        el.addEventListener('change', compute);
      }
    });
    $('pmt_rate').addEventListener('input', function () { $('pmt_rate_val').textContent = (+this.value).toFixed(1) + '%'; });
    $('pmt_years').addEventListener('input', function () { $('pmt_years_val').textContent = this.value + ' 年'; });
    $('pmt_loan_rate').addEventListener('input', function () { $('pmt_loan_rate_val').textContent = (+this.value).toFixed(1) + '%'; });
    $('pmt_loan_years').addEventListener('input', function () { $('pmt_loan_years_val').textContent = this.value + ' 年'; });

    function compute() {
      var ppy = +$('pmt_ppy').value;
      var pmt, total, interest, years, rate, pv, fv;

      if (mode === 'save') {
        fv = +$('pmt_fv').value || 0;
        pv = +$('pmt_pv_save').value || 0;
        rate = (+$('pmt_rate').value) / 100;
        years = +$('pmt_years').value;
        pmt = Finance.PMT({ pv: pv, fv: fv, annualRate: rate, years: years, periodsPerYear: ppy });
        total = pv + pmt * years * ppy;
        interest = fv - total;
      } else {
        pv = +$('pmt_pv_loan').value || 0;
        rate = (+$('pmt_loan_rate').value) / 100;
        years = +$('pmt_loan_years').value;
        pmt = Finance.PMT({ pv: pv, annualRate: rate, years: years, periodsPerYear: ppy });
        total = pmt * years * ppy;
        interest = total - pv;
      }

      $('pmt_result').textContent = money(pmt);
      $('pmt_total').textContent = money(total);
      var intEl = $('pmt_interest');
      intEl.textContent = money(Math.abs(interest));
      intEl.className = 'val ' + (mode === 'save' ? 'positive' : 'negative');

      // 圖表：本金 vs 利息佔比（長條堆疊）或逐年
      var ch = getChart('chart_pmt');
      if (ch) {
        if (mode === 'save') {
          // 不同期限下所需 PMT 曲線
          var yearList = [], pmtList = [];
          for (var y = 1; y <= 30; y++) {
            yearList.push(y + '年');
            pmtList.push(Math.round(Finance.PMT({ pv: pv, fv: fv, annualRate: rate, years: y, periodsPerYear: ppy })));
          }
          ch.setOption({
            tooltip: Object.assign({}, baseTooltip, { trigger: 'axis', valueFormatter: function (v) { return money(v); } }),
            grid: { left: 60, right: 20, top: 30, bottom: 30 },
            xAxis: Object.assign({ type: 'category', name: '期限', data: yearList }, baseAxis),
            yAxis: Object.assign({ type: 'value', scale: true, axisLabel: { color: C.muted, fontSize: 11 } }, baseAxis),
            series: [{
              name: '每期應投入', type: 'line', smooth: true, symbol: 'none',
              lineStyle: { color: C.accent, width: 2.5 },
              areaStyle: { color: 'rgba(201,146,60,0.15)' },
              itemStyle: { color: C.accent },
              data: pmtList,
              markPoint: {
                symbol: 'circle', symbolSize: 10,
                itemStyle: { color: C.accent2, borderColor: C.card, borderWidth: 2 },
                label: { show: false },
                data: [{ coord: [years - 1, Math.round(pmt)], name: '目前' }]
              }
            }]
          }, true);
        } else {
          // 貸款：逐年本金/利息構成（堆疊長條）
          var amort = Finance.amortizationSchedule({ pv: pv, annualRate: rate, years: years, periodsPerYear: ppy });
          var yearlyPrincipal = [], yearlyInterest = [], yearLabels = [];
          for (var yr = 1; yr <= years; yr++) {
            var start = (yr - 1) * ppy, end = Math.min(yr * ppy, amort.length);
            var sp = 0, si = 0;
            for (var i = start; i < end; i++) { sp += amort[i].principal; si += amort[i].interest; }
            yearLabels.push('第' + yr + '年');
            yearlyPrincipal.push(Math.round(sp));
            yearlyInterest.push(Math.round(si));
          }
          ch.setOption({
            tooltip: Object.assign({}, baseTooltip, { trigger: 'axis', valueFormatter: function (v) { return money(v); } }),
            legend: { textStyle: { color: C.muted }, top: 0, icon: 'roundRect' },
            grid: { left: 60, right: 20, top: 40, bottom: 30 },
            xAxis: Object.assign({ type: 'category', data: yearLabels }, baseAxis),
            yAxis: Object.assign({ type: 'value', axisLabel: { color: C.muted, fontSize: 11, formatter: function (v) { return (v / 10000) + '萬'; } } }, baseAxis),
            series: [
              { name: '本金', type: 'bar', stack: 'pay', itemStyle: { color: C.accent2 }, data: yearlyPrincipal },
              { name: '利息', type: 'bar', stack: 'pay', itemStyle: { color: C.accent }, data: yearlyInterest }
            ]
          }, true);

          // 攤還表（顯示前 12 期 + 最後 1 期）
          var tbody = $('pmt_amort_body');
          tbody.innerHTML = '';
          var showRows = [];
          for (var k = 0; k < Math.min(12, amort.length); k++) showRows.push(amort[k]);
          if (amort.length > 12) showRows.push(amort[amort.length - 1]);
          showRows.forEach(function (row, idx) {
            var tr = document.createElement('tr');
            if (idx === 12 && amort.length > 12) {
              tr.innerHTML = '<td colspan="5" style="text-align:center;color:var(--muted);">… 中間省略，顯示最後一期 …</td>';
            } else {
              tr.innerHTML =
                '<td>第 ' + row.period + ' 期</td>' +
                '<td>' + fmt(row.payment) + '</td>' +
                '<td style="color:var(--accent2);">' + fmt(row.principal) + '</td>' +
                '<td style="color:var(--accent);">' + fmt(row.interest) + '</td>' +
                '<td>' + fmt(row.balance) + '</td>';
            }
            tbody.appendChild(tr);
          });
        }
      }
    }
    compute();
  })();

  // ---------- 初始化圖示 ----------
  renderIcons();
})();
