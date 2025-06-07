# seshen_qr_multi.py
import os
import json
import asyncio
import io

import qrcode
from telethon import TelegramClient, errors
from telethon.sessions import StringSession
from telethon.errors import SessionPasswordNeededError, BadRequestError, AuthKeyError
from rich.prompt import Prompt
from rich import print

SESSIONS_FILE = "sessions.json"

def save_session(phone, session_string, api_id, api_hash):
    sessions = []
    if os.path.exists(SESSIONS_FILE):
        with open(SESSIONS_FILE, "r", encoding="utf-8") as f:
            try:
                sessions = json.load(f)
            except json.JSONDecodeError:
                print("[yellow]⚠️ קובץ sessions.json קיים אך אינו תקין. ייווצר מחדש.[/yellow]")

    # בדיקה אם המספר כבר קיים, לעדכן במקום להוסיף כפילות
    for session in sessions:
        if session["phone"] == phone:
            session.update({
                "session_string": session_string,
                "api_id": api_id,
                "api_hash": api_hash,
                "use_tor": False
            })
            break
    else:
        # לא נמצא, מוסיפים חדש
        sessions.append({
            "phone": phone,
            "session_string": session_string,
            "api_id": api_id,
            "api_hash": api_hash,
            "use_tor": False
        })

    with open(SESSIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(sessions, f, ensure_ascii=False, indent=2)
    print(f"[green]✅ סשן נשמר בהצלחה ב־{SESSIONS_FILE}[/green]")

async def generate_qr(client):
    while True:
        try:
            qr_login = await client.qr_login()
            print("\n📱 סרוק את הקוד הבא מתוך אפליקציית Telegram שלך:")
            print("Settings → Devices → Scan QR code\n")

            # הפקת QR לטקסט
            qr_text = io.StringIO()
            qr_obj = qrcode.QRCode(border=2)
            qr_obj.add_data(qr_login.url)
            qr_obj.print_ascii(out=qr_text)
            print(qr_text.getvalue())

            print("⏳ ממתינים לסריקה (עד 2 דקות)...")
            await qr_login.wait(timeout=120)
            return True

        except asyncio.TimeoutError:
            print("[yellow]⌛ פג תוקף הקוד. יוצרים QR חדש...[/yellow]")
            continue
        except BadRequestError as e:
            print(f"[red]❌ שגיאה בבקשת QR: {e}[/red]")
            return False
        except AuthKeyError as e:
            print(f"[red]❌ בעיית מפתח: {e}[/red]")
            return False
        except Exception as e:
            if "password is required" in str(e).lower():
                return "password_required"
            print(f"[red]❌ שגיאה בלתי צפויה: {e}[/red]")
            return False

async def create_session():
    print("[bold blue]🔐 יצירת סשן חדש באמצעות QR[/bold blue]\n")

    api_id = Prompt.ask("🔢 הזן API ID", default="")
    while not api_id.isdigit():
        print("[red]אנא הזן מספר תקין ל-API ID[/red]")
        api_id = Prompt.ask("🔢 הזן API ID", default="")

    api_id = int(api_id)
    api_hash = Prompt.ask("🧬 הזן API HASH")

    # אפשרות להזין טלפון ידנית או לקבל מהלקוח אחרי חיבור
    phone = Prompt.ask("📱 הזן מספר טלפון בפורמט בינלאומי (לדוגמה +972501234567)")

    client = TelegramClient(StringSession(), api_id, api_hash)

    try:
        await client.connect()
    except Exception as e:
        print(f"[red]❌ שגיאה בעת התחברות: {e}[/red]")
        return

    if await client.is_user_authorized():
        print("[green]✅ כבר מחובר – מייצר מחרוזת Session[/green]")
    else:
        result = await generate_qr(client)
        if result == "password_required":
            password = Prompt.ask("🔒 הזן סיסמת דו-שלבי (2FA)", password=True)
            try:
                await client.sign_in(password=password)
            except Exception as e:
                print(f"[red]❌ שגיאה באימות דו-שלבי: {e}[/red]")
                await client.disconnect()
                return
        elif not result:
            await client.disconnect()
            return

    session_string = client.session.save()
    print(f"\n[green]✅ Session string נוצרה בהצלחה:[/green]\n{session_string}\n")

    save_session(phone, session_string, api_id, api_hash)

    await client.disconnect()

async def main():
    print("[bold magenta]ברוכים הבאים לסקריפט יצירת סשנים עם QR![/bold magenta]\n")
    while True:
        await create_session()
        again = Prompt.ask("\n✨ האם ליצור סשן נוסף? (y/n)", choices=["y", "n"], default="n")
        if again.lower() != "y":
            print("[bold blue]👋 סיום התהליך. בהצלחה![/bold blue]")
            break

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[red]⏹️ התהליך בוטל על ידי המשתמש[/red]")
