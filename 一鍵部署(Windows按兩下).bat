@echo off
chcp 65001 >nul
title 一鍵部署到 GitHub
echo ============================================
echo    理財網站一鍵部署到 GitHub
echo ============================================
echo.
echo 即將推送完整網站到你的 GitHub 儲存庫...
echo (會覆蓋你之前上傳的不完整檔案，屬正常現象)
echo.
pause
echo.
echo 正在推送中，請稍候...
echo (第一次會要求輸入 GitHub 帳號與 Personal Access Token)
echo (密碼欄位請貼上 Token，不是你的 GitHub 密碼)
echo.
git push -u origin main --force
echo.
if %errorlevel%==0 (
    echo ============================================
echo    ✅ 部署成功！
echo    ============================================
echo.
echo    網站網址：
echo    https://chloe20020103-gif.github.io/finance-planner/
echo.
echo    最後一步：到 GitHub 儲存庫 Settings ^> Pages
echo    Source 選 "GitHub Actions"，等 1 分鐘即上線！
echo.
start https://github.com/chloe20020103-gif/finance-planner/settings/pages
) else (
    echo ============================================
echo    ❌ 推送失敗
echo    ============================================
echo.
echo    常見原因：
echo    1. 密碼欄位貼錯 Token (不是 GitHub 密碼)
echo    2. 網路連線問題
echo.
echo    請把錯誤訊息截圖給我，我幫你解決！
)
echo.
pause
