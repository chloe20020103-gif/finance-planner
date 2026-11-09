# 理財目標規劃師 — Finance Goal Planner

一個實用且美觀的靜態理財計算網站，內建 **PV（現值）、FV（終值）、PMT（每期付款）** 三大貨幣時間價值函數，並提供**理財目標設定、達成率分析與個人化建議**。

## 功能特色

- **理財目標規劃**：選購屋 / 退休 / 教育金 / 旅遊 / 緊急預備金 / 自訂，輸入現有儲蓄、每月投入、預期報酬率與期限，立即計算：
  - 預估終值、目標缺口、達成率
  - 資產成長軌跡圖（本金 vs 利息）
  - 保守 / 穩健 / 積極三種報酬情境比較
  - 個人化調整建議（提高投入 / 延長期限 / 提高報酬 / 調整目標）
- **FV 終值計算**：已知現值與每期投入，預估未來資產
- **PV 現值計算**：已知未來目標，回推現在應投入多少
- **PMT 每期付款**：儲蓄目標應投入金額，或貸款月付金與攤還表
- **公式說明頁**：完整解釋 PV / FV / PMT 公式與符號定義

## 技術架構

- 純靜態網站：HTML + CSS + Vanilla JavaScript，無框架、無建置步驟
- 圖表：ECharts 5（CDN）
- 圖示：Lucide（CDN）
- 字體：Spectral（標題）+ Public Sans（內文），Google Fonts CDN
- 計算引擎：`assets/js/finance.js`（純函式，可獨立測試）

## 部署到 Cloudflare Pages（兩種方式）

### 方式一：Direct Upload（最簡單，適合 zip 檔）

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/) → 左側選 **Workers & Pages**
2. 點 **Create application** → **Pages** → **Upload assets**
3. 專案名稱輸入（例如 `finance-planner`）→ 點 **Create project**
4. 將本資料夾（解壓縮後的 `finance-planner/`）整個拖曳上傳，或壓成 zip 上傳
5. 等待部署完成，即可取得 `https://<專案名稱>.pages.dev` 網址

> 注意：上傳的是**資料夾內容**（根目錄需有 `index.html`），不是外層資料夾本身。

### 方式二：連接 Git 儲存庫（適合持續更新）

1. 將專案推到 GitHub / GitLab
2. Cloudflare Pages → **Connect to Git** → 選擇儲存庫
3. 建置設定：
   - **Framework preset**：`None`
   - **Build command**：（留空）
   - **Build output directory**：`/`（或專案根目錄）
4. 點 **Save and Deploy**

## 部署到 GitHub Pages（兩種方式）

> 已內建 `.nojekyll`（關閉 Jekyll 處理）與 GitHub Actions 自動部署 workflow。

### 方式一：GitHub Actions 自動部署（推薦）

1. 在 GitHub 建立新儲存庫（例如 `finance-planner`）
2. 將本資料夾內容推送到 `main` 分支：
   ```bash
   cd finance-planner
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<你的帳號>/finance-planner.git
   git push -u origin main
   ```
3. 至儲存庫 **Settings → Pages**，在 **Build and deployment** 的 **Source** 選擇 **GitHub Actions**
4. 首次推送後，Actions 會自動執行部署（約 1 分鐘），完成後網址為：
   `https://<你的帳號>.github.io/finance-planner/`

### 方式二：手動設定（從分支部署）

1. 推送程式碼到 `main` 分支
2. 至 **Settings → Pages**，**Source** 選擇 **Deploy from a branch**
3. Branch 選擇 `main`，資料夾選擇 `/ (root)`，儲存
4. 等待數十秒，網站即上線

## 檔案結構

```
finance-planner/
├── index.html              # 主頁面（單頁應用，五個頁籤）
├── assets/
│   ├── css/
│   │   └── style.css       # 深色金融主題樣式
│   └── js/
│       ├── finance.js      # PV / FV / PMT 計算引擎（純函式）
│       └── app.js          # 互動邏輯與 ECharts 圖表
├── .nojekyll               # GitHub Pages：關閉 Jekyll 處理
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Actions 自動部署到 Pages
├── _headers                # Cloudflare 快取與安全標頭設定（GitHub 會自動忽略）
└── README.md               # 本說明檔
```

## 本地預覽

直接用瀏覽器打開 `index.html` 即可，或啟動一個簡單伺服器：

```bash
cd finance-planner
python3 -m http.server 8080
# 瀏覽器開啟 http://localhost:8080
```

## 免責聲明

本工具計算結果僅供教育與參考用途，不構成投資建議。實際投資報酬會因市場波動、費用與稅賦而不同。
