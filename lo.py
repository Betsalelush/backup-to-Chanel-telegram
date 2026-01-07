import asyncio
from telethon import TelegramClient
from telethon.errors import FloodWaitError, SessionPasswordNeededError, RPCError
from datetime import datetime
import pyshorteners

MAX_RETRIES = 3

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def shorten_url(long_url):
    """מקצר URL באמצעות TinyURL"""
    try:
        s = pyshorteners.Shortener()
        short_url = s.tinyurl.short(long_url)
        log(f"✔ קישור מקוצר נוצר: {short_url}")
        return short_url
    except Exception as e:
        log(f"❌ שגיאה בקיצור קישור: {e}")
        log("💡 ננסה עם Bitly...")
        try:
            short_url = s.bitly.short(long_url)
            log(f"✔ קישור Bitly נוצר: {short_url}")
            return short_url
        except:
            log("⚠️ לא הצלחנו לקצר, נשלח את הקישור המקורי")
            return long_url

async def main():
    log("התחלת תהליך")

    api_id = int(input("הכנס api_id: ").strip())
    api_hash = input("הכנס api_hash: ").strip()
    phone = input("הכנס מספר טלפון בפורמט +972XXXXXXXXX: ").strip()
    
    if not phone.startswith("+"):
        log("❌ מספר טלפון חייב להתחיל ב־+")
        return

    target_chat = input("הכנס @ / לינק / ID של הקבוצה או הערוץ: ").strip()
    bot_command = input("הכנס את הפקודה של הבוט (לדוגמה: /leech2@maxleechzoneprivtebot): ").strip()
    url = input("הכנס את הקישור להורדה: ").strip()

    # קיצור הקישור
    log("מקצר את הקישור...")
    short_url = shorten_url(url)
    
    # בניית ההודעה
    message = f"{bot_command} {short_url}"
    
    log(f"ההודעה שתישלח: {message}")
    confirm = input("להמשיך? (y/n): ").strip().lower()
    
    if confirm != 'y':
        log("בוטל על ידי המשתמש")
        return

    session_name = f"session_{phone.replace('+','')}"
    client = TelegramClient(session_name, api_id, api_hash)

    try:
        log("מתחבר לטלגרם...")
        await client.connect()

        if not await client.is_user_authorized():
            log("נשלח קוד אימות")
            await client.send_code_request(phone)
            code = input("הכנס קוד אימות: ").strip()

            try:
                await client.sign_in(phone=phone, code=code)
            except SessionPasswordNeededError:
                password = input("נדרשת סיסמת 2FA — הכנס סיסמה: ").strip()
                await client.sign_in(password=password)

        log("✔ התחברות ואימות הושלמו")

        log("מזהה יעד...")
        entity = await client.get_entity(target_chat)

        attempt = 1
        success = False
        
        while attempt <= MAX_RETRIES and not success:
            try:
                log(f"שולח הודעה (ניסיון {attempt}/{MAX_RETRIES})...")
                await client.send_message(entity, message)
                log("✔ ההודעה נשלחה בהצלחה!")
                success = True

            except FloodWaitError as e:
                log(f"⏳ FloodWait – ממתין {e.seconds} שניות")
                await asyncio.sleep(e.seconds)
                attempt += 1
                
            except RPCError as e:
                error_msg = str(e)
                
                if "FLOOD_WAIT" in error_msg or "Too many requests" in error_msg:
                    wait_time = getattr(e, 'seconds', 60)
                    log(f"⏳ הגבלת קצב – ממתין {wait_time} שניות")
                    await asyncio.sleep(wait_time)
                    attempt += 1
                    
                elif "EXTERNAL_URL_INVALID" in error_msg or "URL_INVALID" in error_msg:
                    log("❌ טלגרם חוסם את הקישור הזה גם אחרי קיצור!")
                    log("💡 הבוט עלול לא לתמוך בקישורים מקוצרים")
                    log("💡 נסה לשלוח את הקישור המקורי ידנית לבוט")
                    break
                    
                else:
                    log(f"❌ שגיאת טלגרם: {e}")
                    break

        if not success:
            log("❌ השליחה נכשלה לאחר מספר ניסיונות")
            log("💡 אפשרויות נוספות:")
            log("   1. נסה לשלוח ידנית")
            log("   2. בדוק שהבוט פעיל ומקבל הודעות")
            log("   3. נסה קישור אחר לבדיקה")

    except RPCError as e:
        log(f"❌ שגיאת טלגרם: {e}")

    except Exception as e:
        log(f"❌ שגיאה כללית: {e}")

    finally:
        await client.disconnect()
        log("סיום תהליך")

if __name__ == "__main__":
    asyncio.run(main())
