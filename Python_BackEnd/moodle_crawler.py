# Python_BackEnd/moodle_crawler.py
import re
from typing import Any, Dict, List, Tuple
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import requests


class MoodleAuthError(Exception):
    """Moodle 帳號或密碼錯誤"""
    pass


class MoodleCrawlerError(Exception):
    """Moodle 連線或 API 異常"""
    pass


def crawl_moodle_notifications(
    student_id: str, password: str
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    登入銘傳 Moodle 入口網站，並自動跨節點跳轉至真實分流主機 (如 moodle4-06.mcu.edu.tw)，
    呼叫底層 service.php 取得完整的作業截止日與繳交狀態。
    """
    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Referer": "https://moodle.mcu.edu.tw/",
    })

    # 1. 取得入口登入頁面的 logintoken
    login_url = "https://moodle.mcu.edu.tw/login/index.php"
    try:
        res_page = session.get(login_url, timeout=12)
        res_page.encoding = "utf-8"
    except requests.RequestException as e:
        raise MoodleCrawlerError(f"無法連線至 Moodle 登入頁: {str(e)}")

    soup = BeautifulSoup(res_page.text, "html.parser")
    token_input = soup.find("input", {"name": "logintoken"})
    logintoken = token_input.get("value", "") if token_input else ""

    # 2. 模擬入口網站帳密登入
    payload = {
        "username": student_id,
        "password": password,
        "logintoken": logintoken,
    }

    try:
        res_post = session.post(login_url, data=payload, timeout=15)
        res_post.encoding = "utf-8"
    except requests.RequestException as e:
        raise MoodleCrawlerError(f"登入連線逾時: {str(e)}")

    if "login/index.php" in res_post.url and (
        "無效的登入" in res_post.text or "帳號或密碼錯誤" in res_post.text
    ):
        raise MoodleAuthError("Moodle 帳號或密碼不正確，請重新確認。")

    # 3. 取得入口網站主頁，尋找跨節點遠端課程 (如 11501-13454機器學習) 跳轉連結
    home_url = "https://moodle.mcu.edu.tw/"
    res_home = session.get(home_url, timeout=12)
    soup_home = BeautifulSoup(res_home.text, "html.parser")

    target_course_jump = None
    for a in soup_home.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True)
        # 比對 MNet 跳轉特徵、分流主機特徵或學期課號 (如 11501-13454)
        if "mnet/jump.php" in href or "moodle4" in href:
            target_course_jump = urljoin(home_url, href)
            break
        if re.search(r"\d{5}-\d+", text) and ("course" in href or "jump" in href):
            target_course_jump = urljoin(home_url, href)
            break

    # 若首頁沒找到，嘗試在 /my/ 個人儀表板尋找
    if not target_course_jump:
        res_my = session.get("https://moodle.mcu.edu.tw/my/", timeout=12)
        soup_my = BeautifulSoup(res_my.text, "html.parser")
        for a in soup_my.find_all("a", href=True):
            href = a["href"]
            if "mnet/jump.php" in href or "moodle4" in href or "/course/view.php" in href:
                target_course_jump = urljoin("https://moodle.mcu.edu.tw/my/", href)
                break

    print(f"\n[Moodle Crawler Debug]")
    print(f"  尋找到的課程跳轉連結: {target_course_jump}")

    # 4. 執行跨節點跳轉（讓 Session 跟隨跳轉抵達 moodle4-06.mcu.edu.tw）
    if target_course_jump:
        try:
            res_jump = session.get(target_course_jump, timeout=15)
            landed_url = res_jump.url
        except Exception as e:
            print(f"  跳轉課程失敗，切換為預設節點: {e}")
            landed_url = "https://moodle4-06.mcu.edu.tw/"
    else:
        landed_url = "https://moodle4-06.mcu.edu.tw/"

    parsed_origin = urlparse(landed_url)
    node_origin = f"{parsed_origin.scheme}://{parsed_origin.netloc}"
    print(f"  已成功抵達實際分流主機: {node_origin}")

    # 5. 造訪分流節點的通知中心
    notif_page_url = f"{node_origin}/message/output/popup/notifications.php"
    try:
        res_notif = session.get(notif_page_url, timeout=15)
        node_html = res_notif.text
    except requests.RequestException as e:
        raise MoodleCrawlerError(f"連線至分流節點通知頁面失敗: {str(e)}")

    # 6. 從分流主機頁面精準擷取 sesskey 與 Moodle UserID (例如 5649)
    sesskey_match = (
        re.search(r'"sesskey"\s*:\s*"([a-zA-Z0-9]+)"', node_html)
        or re.search(r'sesskey=([a-zA-Z0-9]+)', node_html)
    )
    if not sesskey_match:
        raise MoodleCrawlerError("跳轉成功但無法取得分流節點 sesskey。")
    sesskey = sesskey_match.group(1)

    combined_html = node_html + " " + getattr(locals().get("res_jump", None), "text", "")
    userid_match = (
        re.search(r'"useridto"\s*:\s*"?(\d+)"?', combined_html)
        or re.search(r'data-userid="(\d+)"', combined_html)
        or re.search(r'"userId"\s*:\s*"?(\d+)"?', combined_html)
        or re.search(r'/user/(?:profile|view)\.php\?id=(\d+)', combined_html)
    )
    moodle_userid = userid_match.group(1) if userid_match else "0"

    print(f"  分流節點 sesskey: {sesskey}")
    print(f"  分流節點 Moodle UserID: {moodle_userid}")

    # 7. 向真實分流節點呼叫 service.php Web Service
    service_url = f"{node_origin}/lib/ajax/service.php?sesskey={sesskey}&info=message_popup_get_popup_notifications"
    api_payload = [
        {
            "index": 0,
            "methodname": "message_popup_get_popup_notifications",
            "args": {
                "limit": 50,
                "offset": 0,
                "useridto": moodle_userid,
            },
        }
    ]

    try:
        res_api = session.post(service_url, json=api_payload, timeout=15)
        api_json = res_api.json()
    except Exception as e:
        raise MoodleCrawlerError(f"讀取 Moodle 通知 API 失敗: {str(e)}")

    try:
        notifications = api_json[0].get("data", {}).get("notifications", [])
    except (IndexError, AttributeError):
        notifications = []

    print(f"  成功接收到 {len(notifications)} 筆原生通知！\n")

    submitted_titles = set()
    raw_assignments = []
    feeds = []

    # 8. 清洗資料與狀態判讀
    for item in notifications:
        subject = item.get("subject", "").strip()
        full_text = item.get("fullmessage", "") or item.get("text", "") or subject
        assign_name = item.get("contexturlname", "").strip()

        # A. 收集已繳交作業
        sub_match = re.search(r"您已經繳交\s*(.+?)\s*作業了", subject)
        if sub_match:
            submitted_titles.add(sub_match.group(1).strip())
            if assign_name:
                submitted_titles.add(assign_name)
            continue

        # B. 收集作業截止提醒
        # 範例：到期日 2026年 10月 7日(週三) 12:30: 元件資料整批修改
        due_match = re.search(r"到期日\s*(.+?\d{1,2}:\d{2}):\s*(.+)", subject) or re.search(
            r"到期日\s*(\d{4}年.*?)(?::\s*|\s+)(.+)", subject
        )
        if due_match:
            due_time = due_match.group(1).strip()
            title = assign_name if assign_name else due_match.group(2).strip()

            course_name = "課堂作業"
            if "->" in full_text:
                course_name = full_text.split("->")[0].strip()
            elif "課程:" in full_text or "課程：" in full_text:
                course_match = re.search(r"課程[:：]\s*([^\s]+.*?)\s*中的作業", full_text)
                if course_match:
                    course_name = course_match.group(1).strip()

            raw_assignments.append({
                "title": title,
                "course": course_name,
                "due": due_time,
            })
            continue

        # C. 收集回饋與公告
        if any(kw in subject for kw in ["作業回饋", "公告", "異動", "提醒"]):
            feeds.append({
                "icon": "chatbubble-ellipses-outline" if "回饋" in subject else "megaphone-outline",
                "title": subject,
                "content": full_text.strip(),
                "time": item.get("timecreatedpretty", "近期"),
                "type": "課堂公告",
            })

    # 9. 去除重複作業並自動標記完成狀態
    assignments = []
    seen = set()
    for a in raw_assignments:
        title = a["title"]
        if title in seen:
            continue
        seen.add(title)

        is_done = any(
            title == sub or sub in title or title in sub
            for sub in submitted_titles
        )
        assign_id = f"moodle_{abs(hash(title))}"

        assignments.append({
            "assignment_id": assign_id,
            "title": title,
            "course": a["course"],
            "due": a["due"],
            "is_done": is_done,
        })

    return assignments, feeds