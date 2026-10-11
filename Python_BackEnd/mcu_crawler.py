# Python_BackEnd/mcu_crawler.py
import re
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin

from bs4 import BeautifulSoup
import requests


class MCUAuthError(Exception):
    """校務系統認證失敗（帳密錯誤）"""
    pass


class MCUCrawlerError(Exception):
    """校務系統連線或網頁解析異常"""
    pass


def parse_student_info(soup: BeautifulSoup) -> Dict[str, Any]:
    """
    解析自我畢業審查頁面頂部的學生基本資訊（姓名、年級、系級）
    """
    text = soup.get_text()
    info: Dict[str, Any] = {
        "student_name": None,
        "grade": "大四",  # 預設大四
        "department": None,
    }

    # 1. 解析真實姓名（頁面常見格式：姓名：王大明 或 姓名:王大明）
    name_match = re.search(r"姓名\s*[:：]\s*([^\s\r\n\t <]+)", text)
    if name_match:
        candidate = name_match.group(1).strip()
        # 排除誤抓到後續標題文字
        if candidate and not any(kw in candidate for kw in ["學號", "系級", "班級", "身分證", "資訊"]):
            info["student_name"] = candidate

    # 2. 解析系級（頁面常見格式：系級：資訊管理學系四年級甲班）
    dept_match = re.search(r"(?:系級|系所|科系)\s*[:：]\s*([^\s\r\n\t <]+)", text)
    if dept_match:
        info["department"] = dept_match.group(1).strip()

    # 3. 解析真實年級
    if any(kw in text for kw in ["四年級", "4年級", "大四"]):
        info["grade"] = "大四"
    elif any(kw in text for kw in ["三年級", "3年級", "大三"]):
        info["grade"] = "大三"
    elif any(kw in text for kw in ["二年級", "2年級", "大二"]):
        info["grade"] = "大二"
    elif any(kw in text for kw in ["一年級", "1年級", "大一"]):
        info["grade"] = "大一"
    elif "延修" in text:
        info["grade"] = "延修生"

    return info

def parse_graduation_competencies(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    """
    精準解析學校「畢業資格檢定」表格（排除服務學習等非必要項目）
    """
    competencies = []

    for table in soup.find_all("table"):
        if table.find("table") is not None:
            continue

        text = table.get_text()
        if "檢定結果" in text and "項目" in text:
            for tr in table.find_all("tr"):
                cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]

                if not cells or "項目" in cells or "畢業資格檢定" in cells:
                    continue

                # 🌟 左欄檢查：排除含有「服務學習」的項目
                if len(cells) >= 2:
                    name1, res1 = cells[0], cells[1]
                    if res1 in ["通過", "未通過"] and name1 and ("服務學習" not in name1):
                        competencies.append({
                            "name": name1,
                            "status": "passed" if res1 == "通過" else "pending",
                            "requirement": f"學校審查狀態：{res1}",
                        })

                # 🌟 右欄檢查：排除含有「服務學習」的項目
                if len(cells) >= 4:
                    name2, res2 = cells[2], cells[3]
                    if res2 in ["通過", "未通過"] and name2 and ("服務學習" not in name2):
                        competencies.append({
                            "name": name2,
                            "status": "passed" if res2 == "通過" else "pending",
                            "requirement": f"學校審查狀態：{res2}",
                        })

            if competencies:
                break

    unique_competencies = []
    seen_names = set()
    for c in competencies:
        if c["name"] not in seen_names:
            seen_names.add(c["name"])
            unique_competencies.append(c)

    return unique_competencies


def crawl_eportfolio_courses(session: requests.Session) -> List[Dict[str, Any]]:
    """
    抓取 MCU ePortfolio (學生學習歷程檔案系統) page02/index.asp?ch=6
    取得該學生修課時間、課程名稱、專任教師與通過狀態
    """
    eportfolio_url = "https://eportfolio.mcu.edu.tw/ePortfolio/Student/page02/index.asp?ch=6"
    courses = []
    try:
        res = session.get(
            eportfolio_url,
            headers={"Referer": "https://www.mcu.edu.tw/student/new-query/"},
            timeout=10,
        )
        res.encoding = res.apparent_encoding or "big5"
        soup = BeautifulSoup(res.text, "html.parser")

        current_term = ""
        for table in soup.find_all("table"):
            for tr in table.find_all("tr"):
                text = tr.get_text(strip=True)
                # 判斷是否為學期分組列，例如「110學年度第1學期」或「110-1」
                term_match = re.search(
                    r"(\d{2,3})\s*(?:學年度|[-_/])\s*(?:第?\s*([12上下])\s*學期|(\d))",
                    text,
                )
                if term_match:
                    y = term_match.group(1)
                    s_raw = term_match.group(2) or term_match.group(3)
                    s = "1" if s_raw in ["1", "上"] else "2"
                    current_term = f"{y}-{s}"

                cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
                if len(cells) < 3:
                    continue

                if any(kw in "".join(cells) for kw in ["科目名稱", "課程名稱", "學期", "學分", "教師"]):
                    continue

                course_id = ""
                course_name = ""
                teacher = "---"
                credits = 0.0
                score = None
                is_passed = True
                term = current_term

                for c_text in cells:
                    tm = re.search(r"^(\d{2,3})[-_/]?([12])$", c_text)
                    if tm:
                        term = f"{tm.group(1)}-{tm.group(2)}"
                    elif re.match(r"^\d(?:\.0)?$", c_text) and credits == 0.0:
                        try:
                            credits = float(c_text)
                        except Exception:
                            pass
                    elif re.match(r"^\d{4,6}$", c_text) and not course_id:
                        course_id = c_text
                    elif c_text.replace(".", "", 1).isdigit() and 0 <= float(c_text) <= 100:
                        try:
                            score = float(c_text)
                            is_passed = score >= 60
                        except Exception:
                            pass

                text_cells = [
                    c for c in cells
                    if not re.match(r"^\d+(\.\d+)?$", c)
                    and c not in ["必修", "選修", "通過", "及格", "不通過", "不及格"]
                ]
                if text_cells:
                    course_name = text_cells[0]
                    if len(text_cells) > 1:
                        cand = text_cells[1]
                        if cand and cand not in ["專任教師", "授課教師", "---"]:
                            teacher = cand

                if course_name:
                    courses.append({
                        "course_id": course_id or course_name,
                        "course_name": course_name,
                        "semester_term": term,
                        "credits": credits,
                        "score": score,
                        "is_passed": is_passed,
                        "teacher": teacher,
                    })
    except Exception as e:
        print(f"ePortfolio爬取跳過: {e}")

    return courses



def crawl_mcu_transcript(
    student_id: str, password: str
) -> Tuple[Dict[str, int], List[Dict[str, Any]], Dict[str, Any]]:
    """
    登入銘傳校務系統並抓取「自我畢業審查」歷年修課明細、學分統計與學生資訊。
    回傳: (summary, unique_courses, student_info)
    """
    session = requests.Session()
    session.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Referer": "https://www.mcu.edu.tw/student/new-query/index.html",
    })

    # 1. 模擬登入入口
    login_url = "https://www.mcu.edu.tw/student/new-query/Chk_Pass_New_v2.asp"
    login_payload = {
        "t_tea_no": student_id,
        "t_tea_pass": password,
    }

    try:
        session.post(login_url, data=login_payload, timeout=10)
    except requests.RequestException as e:
        raise MCUCrawlerError(f"學校登入伺服器連線逾時: {str(e)}")

    cookies = session.cookies.get_dict()
    if not any("std" in k or "std_no" in k or "std%5Fno" in k for k in cookies):
        raise MCUAuthError("學生資訊系統帳號或密碼不正確，請重新確認。")

    # 2. 存取橋接授權頁面並自動送出中繼 Form
    bridge_url = "https://www.mcu.edu.tw/student/new-query/Default_AspNet.asp?n=McuGraduate"
    try:
        res_bridge = session.get(bridge_url, timeout=10)
        res_bridge.encoding = "utf-8"

        soup_bridge = BeautifulSoup(res_bridge.text, "html.parser")
        form = soup_bridge.find("form")

        if form and form.get("action"):
            post_target = urljoin(bridge_url, form.get("action"))
            form_data = {
                inp.get("name"): inp.get("value", "")
                for inp in form.find_all("input")
                if inp.get("name")
            }
            session.headers.update({"Referer": bridge_url})
            session.post(post_target, data=form_data, timeout=10)
    except requests.RequestException as e:
        raise MCUCrawlerError(f"跨子系統授權橋接失敗: {str(e)}")

    # 3. 取得自我畢業審查主頁面
    target_url = "https://stu.mcu.edu.tw/appx/GraduateStructure/GS_GraduateStructure.aspx"
    session.headers.update({"Referer": "https://stu.mcu.edu.tw/"})

    try:
        res_target = session.get(target_url, timeout=15)
        res_target.encoding = "utf-8"
    except requests.RequestException as e:
        raise MCUCrawlerError(f"取得畢業審查頁面失敗: {str(e)}")

    html = res_target.text
    if "實際修習學分統計表" not in html and "已列畢業學分" not in html:
        raise MCUCrawlerError("成功連線但未能解析到學分統計結構，可能是學校系統維護中。")

    # 4. 剖析 HTML 資料
    soup = BeautifulSoup(html, "html.parser")

    # 4.0 解析學生基本資料（年級、姓名、系所）與畢業資格檢定
    student_info = parse_student_info(soup)
    competencies = parse_graduation_competencies(soup)

    # 4.1 學分總覽
    summary: Dict[str, int] = {}
    for table in soup.find_all("table"):
        if "實際修習學分統計表" in table.get_text() and "已列畢業學分" in table.get_text():
            for row in table.find_all("tr"):
                cols = [c.get_text(strip=True) for c in row.find_all(["td", "th"])]
                digits = [c for c in cols if c.isdigit()]
                if len(digits) == 4:
                    summary = {
                        "total_taken": int(digits[0]),
                        "total_grad_credit": int(digits[1]),
                        "unlisted_credit": int(digits[2]),
                        "pending_credit": int(digits[3]),
                    }
                    break
            if summary:
                break

    # 4.2 修課明細（支援 rowspan 與通識向度繼承）
    raw_courses = []
    current_category = "通識課程"

    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]

            # 情況 A：完整 8 格以上（包含 category）
            if len(cells) >= 8 and any(char.isdigit() for char in cells[2]) and any(char.isdigit() for char in cells[5]):
                current_category = cells[1] if cells[1] else current_category
                course_id = cells[2]
                course_name = cells[3]
                term = cells[4]
                try:
                    credit = float(cells[5])
                except ValueError:
                    continue
                score_str = cells[6]
                pass_status_str = cells[7]

                score = float(score_str) if score_str.replace(".", "", 1).isdigit() else None
                is_passed = (pass_status_str == "是") or (score is not None and score >= 60)

                raw_courses.append({
                    "course_id": course_id,
                    "course_name": course_name,
                    "category": current_category,
                    "semester_term": term,
                    "credits": credit,
                    "score": score,
                    "is_passed": is_passed,
                    "earned_credits": credit if is_passed else 0.0,
                })

            # 情況 B：因 rowspan 合併縮為 7 格（缺少 category，向前繼承）
            elif len(cells) == 7 and any(char.isdigit() for char in cells[1]) and any(char.isdigit() for char in cells[4]):
                course_id = cells[1]
                course_name = cells[2]
                term = cells[3]
                try:
                    credit = float(cells[4])
                except ValueError:
                    continue
                score_str = cells[5]
                pass_status_str = cells[6]

                score = float(score_str) if score_str.replace(".", "", 1).isdigit() else None
                is_passed = (pass_status_str == "是") or (score is not None and score >= 60)

                raw_courses.append({
                    "course_id": course_id,
                    "course_name": course_name,
                    "category": current_category,
                    "semester_term": term,
                    "credits": credit,
                    "score": score,
                    "is_passed": is_passed,
                    "earned_credits": credit if is_passed else 0.0,
                })

    # 去除巢狀表格重複列
    unique_courses = []
    seen = set()
    for c in raw_courses:
        key = (c["course_id"], c["course_name"], c["semester_term"])
        if key not in seen:
            seen.add(key)
            unique_courses.append(c)

    # 4.3 爬取 ePortfolio (page02/index.asp?ch=6) 補齊教師姓名與修課資訊
    try:
        ep_courses = crawl_eportfolio_courses(session)
        if ep_courses:
            ep_by_term = {
                (c["course_name"], c["semester_term"]): c
                for c in ep_courses if c.get("course_name")
            }
            ep_by_name = {
                c["course_name"]: c
                for c in ep_courses if c.get("course_name")
            }

            for c in unique_courses:
                matched = ep_by_term.get((c["course_name"], c["semester_term"])) or ep_by_name.get(c["course_name"])
                if matched and matched.get("teacher") and matched["teacher"] != "---":
                    c["teacher"] = matched["teacher"]
                elif not c.get("teacher"):
                    c["teacher"] = "---"
    except Exception:
        pass

    for c in unique_courses:
        if not c.get("teacher") or c.get("teacher") in ["專任教師", "授課教師"]:
            c["teacher"] = "---"

    # 🌟 回傳 4 個物件：summary, courses, student_info, competencies
    return summary, unique_courses, student_info, competencies