from telethon import TelegramClient, errors, types
import asyncio
import json
import os
import re
from datetime import datetime, timedelta
import logging
import shutil

# הגדרת לוגים
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class מעביר_טלגרם:
    def __init__(self):
        # טעינת הגדרות API מקובץ או משתני סביבה
        self.API_ID = self._get_config('API_ID', 21135587)
        self.API_HASH = self._get_config('API_HASH', '2cb207bbd8229fe12a7dbc2fcc481ce1')
        self.PHONE_NUMBER = None
        
        self.לקוח = None
        self.קובץ_התקדמות = 'התקדמות.json'
        
        # --- שינוי: החזרת הגדרות בטיחות והגבלת קצב ---
        self.השהיה_בין_הודעות = 2  # שניות - מומלץ לשמור על ערך של 1-3 שניות
        self.מקס_הודעות_לדקה = 20 # הגבלה של טלגרם למניעת חסימות
        self.מונה_הודעות_בדקה = 0
        self.זמן_תחילת_דקה = datetime.now()

    def _get_config(self, key, default):
        """טוען הגדרות ממשתני סביבה או מחזיר ברירת מחדל"""
        return os.getenv(key, default)

    def טען_התקדמות(self):
        """טוען נתוני התקדמות מקובץ"""
        if os.path.exists(self.קובץ_התקדמות):
            try:
                with open(self.קובץ_התקדמות, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"שגיאה בטעינת התקדמות: {e}")
        return {"הודעה_אחרונה": 0, "סך_הועברו": 0, "תאריך_עדכון": str(datetime.now())}

    def שמור_התקדמות(self, נתונים):
        """שומר נתוני התקדמות לקובץ"""
        try:
            נתונים["תאריך_עדכון"] = str(datetime.now())
            with open(self.קובץ_התקדמות, 'w', encoding='utf-8') as f:
                json.dump(נתונים, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"שגיאה בשמירת התקדמות: {e}")

    async def בדוק_הגבלות(self):
        """בודק ומנהל את הגבלות קצב השליחה כדי למנוע חסימה."""
        זמן_שעבר = datetime.now() - self.זמן_תחילת_דקה
        
        if זמן_שעבר.total_seconds() >= 60:
            # עברה דקה, אפס את המונה והזמן
            self.מונה_הודעות_בדקה = 0
            self.זמן_תחילת_דקה = datetime.now()
        
        if self.מונה_הודעות_בדקה >= self.מקס_הודעות_לדקה:
            המתנה = 60 - זמן_שעבר.total_seconds()
            if המתנה > 0:
                logger.info(f"הגעת להגבלת הקצב. ממתין {int(המתנה)} שניות...")
                await asyncio.sleep(המתנה)
            # אפס מחדש לאחר ההמתנה
            self.מונה_הודעות_בדקה = 0
            self.זמן_תחילת_דקה = datetime.now()

    async def התחבר(self):
        """יוצר חיבור לטלגרם"""
        try:
            self.PHONE_NUMBER = input("הזן מספר טלפון (כולל קידומת, לדוגמה +972123456789): ").strip()
            if not self.PHONE_NUMBER.startswith('+'):
                self.PHONE_NUMBER = '+' + self.PHONE_NUMBER

            session_file = f"session_{self.PHONE_NUMBER.replace('+', '')}.session"
            
            self.לקוח = TelegramClient(session_file, self.API_ID, self.API_HASH)
            logger.info("מתחבר לטלגרם...")
            await self.לקוח.connect()

            if not await self.לקוח.is_user_authorized():
                logger.info("נדרש אימות...")
                sent_code = await self.לקוח.send_code_request(self.PHONE_NUMBER)
                try:
                    await self.לקוח.sign_in(self.PHONE_NUMBER, input('הזן את קוד האימות: '))
                except errors.SessionPasswordNeededError:
                    await self.לקוח.sign_in(password=input('הזן את סיסמת האימות הדו-שלבי: '))
            
            logger.info("✅ התחברות הושלמה בהצלחה")
            return True
            
        except Exception as e:
            logger.error(f"שגיאה בחיבור: {e}")
            return False

    async def בחר_ערוץ(self, סוג):
        """מאפשר בחירת ערוץ עם בדיקות בטיחות והנחיות ברורות."""
        print(f"\n--- בחירת ערוץ {סוג} ---")
        print("טיפ: כדי למצוא מזהה (ID) של ערוץ, העבר ממנו הודעה לבוט @userinfobot.")
        print("מזהה ערוץ הוא בדרך כלל מספר שלילי שמתחיל ב-100- (לדוגמה: -100123456789).")
        
        while True:
            try:
                מזהה_קלט = input(f"\nהזן מזהה או שם משתמש של ערוץ {סוג} (למשל, @MyChannel או -100...): ").strip()
                if not מזהה_קלט: continue

                try:
                    מזהה = int(מזהה_קלט)
                except ValueError:
                    מזהה = מזהה_קלט

                entity = await self.לקוח.get_entity(מזהה)
                שם = getattr(entity, 'title', getattr(entity, 'username', 'לא ידוע'))
                print(f"✅ נמצא ערוץ/קבוצה: {שם}")
                return entity
                    
            except (ValueError, errors.UsernameNotOccupiedError, errors.ChannelPrivateError) as e:
                logger.error(f"לא נמצא ערוץ עם המזהה '{מזהה_קלט}'. ודא שהמזהה נכון ושהחשבון חבר בערוץ. שגיאה: {e}")
            except Exception as e:
                logger.error(f"אירעה שגיאה: {e}")

    async def העבר_הודעה(self, הודעה, יעד):
        """
        מעתיק הודעה אחת לערוץ יעד. 
        שיטה זו מטפלת בקבצים גדולים (עד 2GB) אוטומטית וללא קרדיט למקור.
        """
        try:
            # בדיקת הגבלות קצב לפני שליחה
            await self.בדוק_הגבלות()
            
            if הודעה.text or הודעה.media:
                # שימוש ב-send_message עם אובייקט ההודעה מעתיק אותה במלואה
                # ללא צורך בהורדה ידנית ובדיקת גודל.
                await self.לקוח.send_message(יעד, message=הודעה)
                self.מונה_הודעות_בדקה += 1 # קדם את המונה רק לאחר הצלחה
                return True
            else:
                logger.warning(f"הודעה {הודעה.id} ריקה, מדלג.")
                return True
            
        except errors.FloodWaitError as e:
            logger.warning(f"הגבלת flood, ממתין {e.seconds + 5} שניות...")
            await asyncio.sleep(e.seconds + 5)
            return await self.העבר_הודעה(הודעה, יעד) # נסה שוב

        except Exception as e:
            logger.error(f"שגיאה בהעברת הודעה {הודעה.id}: {e}")
            return False

    async def התחל_העברה(self):
        """מתחיל את תהליך העברת ההודעות."""
        print("\n=== מעביר הודעות טלגרם (גרסה בטוחה) ===\n")
        
        if not await self.התחבר(): return
        
        מקור = await self.בחר_ערוץ("מקור")
        if not מקור: return
            
        יעד = await self.בחר_ערוץ("יעד")
        if not יעד: return
        
        התקדמות = self.טען_התקדמות()
        
        print("\nאפשרויות:")
        print("1. המשך מההודעה האחרונה")
        print("2. התחל מההתחלה")
        בחירה = input("בחר (1/2): ").strip()
        
        if בחירה == '2':
            התקדמות = {"הודעה_אחרונה": 0, "סך_הועברו": 0}
        
        logger.info(f"מתחיל העברה מהודעה ID > {התקדמות['הודעה_אחרונה']}...")
        
        הודעות_נכשלו_ברצף = 0
        
        try:
            async for הודעה in self.לקוח.iter_messages(
                מקור, 
                reverse=True, 
                offset_id=התקדמות["הודעה_אחרונה"]
            ):
                if הודעה.id <= התקדמות["הודעה_אחרונה"]: continue

                הצלחה = await self.העבר_הודעה(הודעה, יעד)
                
                if הצלחה:
                    התקדמות["סך_הועברו"] += 1
                    הודעות_נכשלו_ברצף = 0
                else:
                    הודעות_נכשלו_ברצף += 1
                    if הודעות_נכשלו_ברצף >= 5:
                        logger.error("5 הודעות נכשלו ברציפות. עוצר את התהליך.")
                        break
                
                התקדמות["הודעה_אחרונה"] = הודעה.id
                
                if התקדמות["סך_הועברו"] % 10 == 0:
                    print(f"הועברו {התקדמות['סך_הועברו']} הודעות... שומר התקדמות.")
                    self.שמור_התקדמות(התקדמות)
                
                await asyncio.sleep(self.השהיה_בין_הודעות)
                
        except KeyboardInterrupt:
            logger.info("העברה הופסקה.")
        except Exception as e:
            logger.error(f"שגיאה כללית: {e}")
        
        finally:
            self.שמור_התקדמות(התקדמות)
            logger.info(f"✅ סבב הושלם! סה\"כ הועברו {התקדמות['סך_הועברו']} הודעות.")

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.לקוח and self.לקוח.is_connected():
            await self.לקוח.disconnect()
            logger.info("חיבור נסגר.")

async def main():
    async with מעביר_טלגרם() as מעביר:
        await מעביר.התחל_העברה()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nהתוכנית נסגרה על ידי המשתמש.")


