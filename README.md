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

後端環境建置指南 (FastAPI + MongoDB Atlas)

本專案後端採用 **FastAPI** 搭配 **MongoDB Atlas** 雲端資料庫。
為了確保團隊資安與環境隔離，機密連線金鑰（`.env`）與虛擬環境（`venv/`）未納入版本控制，每位成員 Clone / Pull 專案後請依下列步驟進行本地環境初始化。

---

## 📋 事前準備 (Prerequisites)

**Python 版本**：官方原生 **Python 3.12** 或 **3.13**（64-bit）
**重要注意事項**：

1.  安裝時務必勾選 **`Add python.exe to PATH`**。
2.  請勿使用 MSYS2、Git Bash 內建或微軟商店捷徑的 Python，否則會因平台不相容導致套件（如 `pydantic-core`）發生 Rust 編譯錯誤。

- **Git**：最新版本

---

## 🚀 快速啟動流程 (Step-by-Step)

1.  取得最新程式碼

新成員（首次下載）：
git clone <專案儲存庫網址>
cd <專案名稱>

既有成員（同步更新）：
git pull origin master

2. 進入後端目錄並建立虛擬環境PowerShellcd Python_BackEnd

# Terminal 執行:

cd Python_BackEnd
進入後端資料夾。

# 建立獨立虛擬環境 執行:

py -m venv venv

🔍 環境檢查點：
展開 Python_BackEnd/venv 資料夾，Windows 環境下內部應包含 Scripts 資料夾。(若出現 bin 資料夾，代表抓到 Linux/MSYS2 環境，請解除安裝非原生 Python 並重新建立)

3. 啟用虛擬環境根據使用的作業系統與終端機執行對應指令
   （成功啟用後終端機提示字元前方會顯示 (venv)）：

# Windows (PowerShell)：

.\venv\Scripts\Activate.ps1

(若出現指令碼執行限制錯誤，請以一般使用者身分執行：
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
後再次啟動)

Windows (CMD)：venv\Scripts\activate.bat
macOS / Linux：source venv/bin/activate

4. 升級 pip 並安裝依賴套件確認終端機開頭為 (venv)

# Terminal 執行：

PowerShellpython -m pip install --upgrade pip

# 下載需求資料執行:

pip install -r requirements.txt

5. 配置環境變數 (.env)在 Python_BackEnd 資料夾內手動建立檔案，命名為 .env。參考同目錄下的 .env.example，填入團隊專屬的資料庫連線字串與密碼：
   程式碼片段

PORT=8000
DB_NAME=school_system
MONGODB_URI=mongodb+srv://ski_junior:<密碼>@cluster0.zeli9gy.mongodb.net/school_system?retryWrites=true&w=majority

6. 啟動本機伺服器

# Terminal 執行：

PowerShelluvicorn main:app --reload --host 0.0.0.0 --port 8000
參數說明：
--reload：程式碼變更時自動重啟伺服器。
--host 0.0.0.0：允許區域網路（如手機 Expo Go）透過電腦 IP 進行跨裝置連線測試。

🔍 連線驗證 (Verification)
伺服器啟動成功後，可在瀏覽器開啟下列網址驗證：服務項目存取網址說明API
http://localhost:8000/api/evaluations 應回傳 MongoDB 雲端資料庫之課評 JSON 資料。
Swagger UI 文件
http://localhost:8000/docsFastAPI 自動生成之 API 介面規格與測試儀表板。

7. 刪掉 Python_BackEnd 裡的 .gitignore 避免出現兩個 .gitignore 互相衝突。

⚠️ 常見問題與排除 (Troubleshooting)

Q1: 安裝 requirements.txt 時卡在 pydantic-core 且噴出 Rust not found？
成因：當前使用的 Python 為 MSYS2/MinGW 環境，非 Windows 官方二進位相容環境。解法：至 Python 官方網站 安裝 Python 3.12 或 3.13（記得打勾 PATH）。刪除 Python_BackEnd/venv。執行 py -m venv venv 重新建立，並確認產生的是 Scripts 目錄。

Q2: VS Code 編輯器提示 Import "fastapi" could not be resolved？
成因：編輯器抓取到全域直譯器，而非當前虛擬環境。解法：按 Ctrl + Shift + P $\rightarrow$ 輸入 Python: Select Interpreter $\rightarrow$ 選取 ./Python_BackEnd/venv/Scripts/python.exe。

Q3: 手機 Expo 前端連不到電腦的後端 API？
同網域檢查：電腦與手機必須連線在同一個 Wi-Fi（建議切換至「手機個人熱點」，避開公共網路的 AP 隔離限制）。IP 查詢：電腦執行 ipconfig 取得無線網卡 IPv4 位址（例如 192.168.x.x）。前端設定：前端請求網址不可填 localhost，需設定為 http://<電腦IPv4>:8000/api/...。
