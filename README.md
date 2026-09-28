# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

---

## 後端環境建置指南 (FastAPI + MongoDB Atlas)

本專案後端採用 **FastAPI** 搭配 **MongoDB Atlas** 雲端資料庫。
為了確保團隊資安與環境隔離，機密連線金鑰（`.env`）與虛擬環境（`venv/`）未納入版本控制，每位成員 Clone / Pull 專案後請依下列步驟進行本地環境初始化。

---

專案環境建置與完整啟動指南
本專案採前後端分離架構（後端：FastAPI + MongoDB，前端：Expo React Native）。
請依照以下流程依序配置兩側環境。

## 一、 事前環境準備 (Prerequisites)

Node.js：至官網下載並安裝 v22 LTS 版本。
Python：安裝官方原生 Python 3.12 或 3.13（64-bit），安裝時務必勾選 Add python.exe to PATH。Git：最新版本。手機端：於手機下載 Expo Go App（iOS App Store / Android Google Play）。

## 二、 取得專案代碼新成員（首次下載）：

git clone <專案儲存庫網址>
cd <專案名稱>
既有成員（更新至最新進度）：
git pull origin master

## 三、 後端啟動流程（FastAPI + MongoDB）

請開啟 第 1 個終端機視窗（Terminal 1）：
進入後端目錄並建立虛擬環境：
cd Python_BackEnd
py -m venv venv

## 啟用虛擬環境：Windows (PowerShell)：

.\venv\Scripts\Activate.ps1
(若跳出安全性執行限制，先執行 Set-ExecutionPolicy RemoteSigned -Scope CurrentUser 後再啟動)

Windows (CMD)：venv\Scripts\activate.bat
macOS / Linux：source venv/bin/activate
(啟用成功後，終端機最前方會顯示 (venv) 標記)

## 升級 pip 並安裝依賴套件：

-先這行
python -m pip install --upgrade pip

-再這行
pip install -r requirements.txt

## 配置後端環境變數檔：

在 Python_BackEnd/ 資料夾內新增檔案並命名為 .env，填入資料庫連線資訊：
程式碼片段:

PORT=8000
DB_NAME=school_system
MONGODB_URI=mongodb+srv://<資料庫帳號>:<資料庫密碼>@cluster0.zeli9gy.mongodb.net/school_system?retryWrites=true&w=majority

## 如果沒有請通知林柏邑組員，林柏邑組員會建立帳號~

## 解決 VS Code 編輯器黃色波浪警告（可選，推薦設定）：

在 VS Code 按下 Ctrl + Shift + P（Mac 為 Cmd + Shift + P）。
搜尋並選擇 Python: Select Interpreter。
選取路徑帶有 ('venv': venv) 或 .\Python_BackEnd\venv\Scripts\python.exe 的選項，底部的波浪警告即會自動清除。

## 啟動後端伺服器：

uvicorn main:app --reload --host 0.0.0.0 --port 8000

驗證檢查：瀏覽器開啟 http://localhost:8000/docs，若能看到 Swagger API 測試介面即代表後端啟動成功。

## 四、 前端啟動流程（Expo React Native App）

請開啟 第 2 個全新的終端機視窗（Terminal 2），保持在專案的最外層根目錄：
安裝前端相依套件：

npm install

## 查詢電腦本機區域網路 IP：

Windows：開啟命令提示字元輸入 ipconfig，找出 IPv4 位址（例如 192.168.1.105）。
macOS：進入「系統設定」->「Wi-Fi」->「詳細資訊」查詢 IP。

## 配置前端連線環境變數：

在專案最外層根目錄建立 .env 檔案，填入剛才查詢到的電腦 IP：
程式碼片段:

EXPO_PUBLIC_API_URL=http://<你的電腦IPv4位址>:8000

(例如：EXPO_PUBLIC_API_URL=[http://192.168.1.105:8000](http://192.168.1.105:8000)，手機與電腦在同一個 Wi-Fi 下才能正確連線後端)

## 啟動前端 Metro 伺服器：

npx expo start -c

## 開啟 App 測試：

確認手機與電腦連接在完全相同的 Wi-Fi 網路。
打開手機相機或 Expo Go 掃描終端機出現的 QR Code，即可將 App 載入手機測試。
